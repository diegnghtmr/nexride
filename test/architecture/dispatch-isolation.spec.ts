/**
 * Architecture Isolation Test — Strict TDD
 *
 * Validates that dispatch module boundaries defined in .dependency-cruiser.cjs
 * have zero violations. Also validates a deliberate-failure case by temporarily
 * creating a forbidden import file and asserting depcruise reports a violation.
 *
 * NOTE: dependency-cruiser requires Node 20. On Node >=22 the --reporter flag
 * may have changed. The test skips gracefully if depcruise is not available.
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

describe('Architecture — Dispatch Isolation Rules', () => {
  it('depcruise reports zero violations on the current codebase', () => {
    // Skip if on Node >= 22 (known depcruise incompatibility with experimental vm modules)
    const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
    if (nodeMajor >= 22) {
      console.warn(
        `Skipping arch:check on Node ${process.version}. depcruise requires Node ≤21. ` +
          `Run \`nvm use 20 && npm run arch:check\` for local repro, ` +
          `or use \`npm run arch:check:docker\`. See docs/adr/ADR-009-arch-check-node-compat.md.`,
      );
      return;
    }

    const { exitCode, stdout } = runDepcruise();
    expect(exitCode).toBe(0);
    if (exitCode !== 0) {
      console.error('depcruise output:\n', stdout);
    }
  });

  it('depcruise detects a deliberate forbidden import (self-test)', () => {
    const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
    if (nodeMajor >= 22) {
      console.warn(
        `Skipping arch:check on Node ${process.version}. depcruise requires Node ≤21. ` +
          `Run \`nvm use 20 && npm run arch:check\` for local repro, ` +
          `or use \`npm run arch:check:docker\`. See docs/adr/ADR-009-arch-check-node-compat.md.`,
      );
      return;
    }

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
