/**
 * Architecture Isolation Test — Strict TDD
 *
 * Validates that dispatch module boundaries defined in .dependency-cruiser.cjs
 * have zero violations. Also validates a deliberate-failure case by temporarily
 * creating a forbidden import file and asserting depcruise reports a violation.
 *
 * NOTE: dependency-cruiser 16.4 works on Node 20 and Node 22 (CI runs Node 22).
 * On Node ≥23 the ESM module `node:fs` no longer exports `R_OK` as a named
 * export and depcruise fails to load. The test skips on Node ≥23 ONLY so that
 * CI on Node 22 still exercises this gate. See ADR-009 §Amendment v0.1.22-mvp.
 *
 * Run via: npm run test:integration (which includes test/architecture/**)
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const CONFIG = join(ROOT, '.dependency-cruiser.cjs');
const FORBIDDEN_FILE = join(ROOT, 'src', 'dispatch', 'infrastructure', '__forbidden_test.ts');

function runDepcruise(extraArgs: string = ''): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(
      `node --experimental-vm-modules node_modules/.bin/depcruise --config ${CONFIG} --output-type err-long src ${extraArgs}`,
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
    );
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    return {
      stdout: execErr.stdout ?? execErr.stderr ?? execErr.message ?? '',
      exitCode: execErr.status ?? 1,
    };
  }
}

// Judgment 16° B2: previously these tests used a bare `return` to skip,
// which made Jest report them as PASSING with no assertions — false-green risk.
// Now we use `it.skip` which marks them as PENDING in the report.
//
// Judgment 22° tightening: depcruise 16.4 works on Node 20 and Node 22 (CI runs
// Node 22), but breaks on Node ≥23 because `node:fs` no longer exports `R_OK` as
// a named export. The skip threshold is now Node ≥23 (was Node ≥22), recovering
// signal on the CI runtime. ADR-009 §Amendment v0.1.22-mvp documents this.
const NODE_MAJOR = parseInt(process.version.slice(1).split('.')[0], 10);
const SKIP_REASON =
  `depcruise 16.4 breaks on Node ≥23 (current: ${process.version}). ` +
  `CI Node 22 runs the test as PASS. For local repro on Node ≥23, use ` +
  `\`npm run arch:check:docker\` (Node 22 container) or upgrade depcruise to 17.4+. ` +
  `See docs/adr/ADR-009-arch-check-node-compat.md §Amendment v0.1.22-mvp.`;
const itOrSkip = NODE_MAJOR >= 23 ? it.skip : it;

describe('Architecture — Dispatch Isolation Rules', () => {
  if (NODE_MAJOR >= 23) {
    console.warn(`[arch-isolation] PENDING on Node ${process.version} — ${SKIP_REASON}`);
  }

  itOrSkip('depcruise reports zero violations on the current codebase', () => {
    const { exitCode, stdout } = runDepcruise();
    expect(exitCode).toBe(0);
    if (exitCode !== 0) {
      console.error('depcruise output:\n', stdout);
    }
  });

  itOrSkip('depcruise detects a deliberate forbidden import (self-test)', () => {
    // Create forbidden file: dispatch/infrastructure importing directly from fleet
    writeFileSync(
      FORBIDDEN_FILE,
      `// deliberate forbidden import for arch test\nimport { FleetService } from '../../fleet/fleet.service';\nexport const _test = FleetService;\n`,
      'utf8',
    );

    try {
      const { exitCode, stdout } = runDepcruise();
      // depcruise should detect the violation and exit non-zero
      expect(exitCode).not.toBe(0);
      const lower = stdout.toLowerCase();
      // Should mention the rule or the forbidden file
      expect(lower).toMatch(/dispatch|fleet|forbidden|violation/);
    } finally {
      // Always clean up — even if test fails
      if (existsSync(FORBIDDEN_FILE)) {
        unlinkSync(FORBIDDEN_FILE);
      }
    }
  });
});
