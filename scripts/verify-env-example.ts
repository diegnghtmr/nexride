#!/usr/bin/env ts-node
/**
 * verify-env-example.ts
 * Smoke validator for .env.example — ensures the file is valid dotenv
 * (no markdown artifacts) and contains every env key that src/** reads
 * at runtime.
 *
 * Usage: ts-node scripts/verify-env-example.ts [--file <path>]
 * Exit 0 = OK, exit 1 = validation failure.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parse as eslintParse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, '.env.example');
const SRC_DIR = path.join(REPO_ROOT, 'src');

/**
 * Keys that are intentionally not listed in .env.example (injected by the
 * platform, CI environment, or runtime defaults). Extend this allowlist
 * when adding genuinely optional / platform-injected keys.
 */
const OPTIONAL_KEYS = new Set([
  'NODE_ENV',    // standard Node.js env; must be in .env.example but also appears in CI auto-inject
  'CI',
  'GITHUB_TOKEN',
  'GITHUB_REF_NAME',
  'GITHUB_SHA',
  'npm_lifecycle_event',
  'npm_package_version',
  // Keys accessed only in test/integration helpers (not src/)
  'THROTTLE_USER_LIMIT',   // app.module.ts uses it but it is an optional prod override
  'THROTTLER_TEST_LIMIT',  // integration-test-only override
  'THROTTLE_IP_LIMIT',     // optional prod override
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let errors = 0;

function fail(msg: string): void {
  console.error(`FAIL: ${msg}`);
  errors++;
}

function info(msg: string): void {
  console.log(`INFO: ${msg}`);
}

// ---------------------------------------------------------------------------
// Step 1: Read .env.example
// ---------------------------------------------------------------------------

const envExamplePath = (() => {
  const argIdx = process.argv.indexOf('--file');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    return path.resolve(process.argv[argIdx + 1]);
  }
  return ENV_EXAMPLE_PATH;
})();

info(`Validating: ${envExamplePath}`);

if (!fs.existsSync(envExamplePath)) {
  fail(`File not found: ${envExamplePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(envExamplePath, 'utf8');

// ---------------------------------------------------------------------------
// Step 2: Reject markdown markers
// ---------------------------------------------------------------------------

const markdownPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^```/m, label: 'triple-backtick fence (```)' },
  { pattern: /^#{2,}\s/m, label: 'markdown H2+ heading (## or ###)' },
  { pattern: /\*\*[^*]+\*\*/m, label: 'markdown bold (**text**)' },
];

for (const { pattern, label } of markdownPatterns) {
  if (pattern.test(raw)) {
    fail(`${envExamplePath} contains ${label} — file must be pure dotenv, not markdown.`);
  }
}

// ---------------------------------------------------------------------------
// Step 3: Parse with dotenv
// ---------------------------------------------------------------------------

let parsed: Record<string, string>;
try {
  parsed = dotenv.parse(raw);
} catch (err) {
  fail(`dotenv.parse() failed: ${(err as Error).message}`);
  process.exit(1);
}

const parsedKeyCount = Object.keys(parsed).length;
if (parsedKeyCount === 0) {
  fail(`dotenv.parse() returned an empty object — file may be empty or unparseable.`);
} else {
  info(`Parsed ${parsedKeyCount} keys from ${path.basename(envExamplePath)}.`);
}

// ---------------------------------------------------------------------------
// Step 4: AST scan of src/**/*.ts for process.env access
// ---------------------------------------------------------------------------

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectEnvKeysFromAst(filePath: string): Set<string> {
  const keys = new Set<string>();
  const source = fs.readFileSync(filePath, 'utf8');

  let ast: ReturnType<typeof eslintParse>;
  try {
    ast = eslintParse(source, {
      range: true,
      loc: true,
      tokens: false,
      comment: false,
      jsx: false,
    });
  } catch {
    // File might have syntax issues — fall back to regex
    const regex = /process\.env(?:\.([A-Z_][A-Z0-9_]*)|(?:\[['"]([A-Z_][A-Z0-9_]*)['"]]\]))/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(source)) !== null) {
      const key = m[1] ?? m[2];
      if (key) keys.add(key);
    }
    return keys;
  }

  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;

    // Detect: process.env.KEY (MemberExpression on process.env)
    if (
      n.type === AST_NODE_TYPES.MemberExpression &&
      typeof n.object === 'object' && n.object !== null &&
      (n.object as Record<string, unknown>).type === AST_NODE_TYPES.MemberExpression
    ) {
      const obj = n.object as Record<string, unknown>;
      const innerObj = obj.object as Record<string, unknown> | undefined;
      const innerProp = obj.property as Record<string, unknown> | undefined;
      if (
        innerObj?.type === AST_NODE_TYPES.Identifier && (innerObj as Record<string, unknown>).name === 'process' &&
        innerProp?.type === AST_NODE_TYPES.Identifier && (innerProp as Record<string, unknown>).name === 'env'
      ) {
        // n.property is the key
        const prop = n.property as Record<string, unknown> | undefined;
        if (prop?.type === AST_NODE_TYPES.Identifier) {
          keys.add(prop.name as string);
        } else if (prop?.type === AST_NODE_TYPES.Literal && typeof prop.value === 'string') {
          keys.add(prop.value);
        }
      }
    }

    // Recurse into all child nodes
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  }

  visit(ast.body);
  return keys;
}

const srcFiles = collectTsFiles(SRC_DIR);
info(`Scanning ${srcFiles.length} TypeScript files in src/ for process.env access...`);

const requiredKeys = new Set<string>();
for (const file of srcFiles) {
  const keys = collectEnvKeysFromAst(file);
  for (const key of keys) {
    requiredKeys.add(key);
  }
}

info(`Found ${requiredKeys.size} env key(s) referenced in src/.`);

// ---------------------------------------------------------------------------
// Step 5: Assert required keys ⊆ parsed keys (minus allowlist)
// ---------------------------------------------------------------------------

const missingKeys: string[] = [];
for (const key of requiredKeys) {
  if (OPTIONAL_KEYS.has(key)) continue;
  if (!(key in parsed)) {
    missingKeys.push(key);
  }
}

if (missingKeys.length > 0) {
  fail(
    `Missing key(s) in ${path.basename(envExamplePath)}: ${missingKeys.join(', ')}\n` +
    `  These keys are referenced in src/ but absent from the template.\n` +
    `  Add them or add to OPTIONAL_KEYS allowlist if intentionally absent.`,
  );
} else {
  info(`All required runtime keys are present in ${path.basename(envExamplePath)}.`);
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

if (errors === 0) {
  info(`verify-env-example: OK — ${path.basename(envExamplePath)} is valid.`);
  process.exit(0);
} else {
  console.error(`verify-env-example: ${errors} ERROR(S) FOUND — see above.`);
  process.exit(1);
}
