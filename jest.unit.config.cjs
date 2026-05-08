/** @type {import('jest').Config} */
module.exports = {
  displayName: 'unit',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@dispatch/(.*)$': '<rootDir>/src/dispatch/$1',
    '^@fleet/(.*)$': '<rootDir>/src/fleet/$1',
    '^@safe-points/(.*)$': '<rootDir>/src/safe-points/$1',
    '^@trip/(.*)$': '<rootDir>/src/trip/$1',
    '^@analytics/(.*)$': '<rootDir>/src/analytics/$1',
    '^@rider/(.*)$': '<rootDir>/src/rider/$1',
  },
  coverageDirectory: 'coverage/unit',
  collectCoverageFrom: [
    'src/dispatch/domain/**/*.ts',
    'src/dispatch/application/**/*.ts',
    'src/dispatch/infrastructure/providers/**/*.ts',
    'src/safe-points/safe-points.service.ts',
    '!src/**/*.module.ts',
    '!src/**/*.entity.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    'src/dispatch/domain/**/*.ts': { statements: 85, branches: 80 },
    // Judgment 16° B1: application orchestrators included in the gate. Statements
    // gate at 80 (vs 85 for domain) and branches at 40 (vs 80) because abort /
    // timeout / fallback / suggestion-event paths are dominantly integration-tested
    // (rides.request.spec.ts + rides.confirm.spec.ts), and duplicating them as
    // unit tests would add maintenance cost without catching real regressions.
    'src/dispatch/application/**/*.ts': { statements: 80, branches: 40 },
    'src/dispatch/infrastructure/providers/**/*.ts': { statements: 85, branches: 80 },
    'src/safe-points/safe-points.service.ts': { statements: 85, branches: 80 },
  },
};
