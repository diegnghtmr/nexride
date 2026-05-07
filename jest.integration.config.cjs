/** @type {import('jest').Config} */
module.exports = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts', '<rootDir>/test/architecture/**/*.spec.ts'],
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
  testTimeout: 120000,
  globalSetup: undefined,
  globalTeardown: undefined,
  // Sets THROTTLER_DISABLED=1 before any AppModule bootstrap — prevents 429 in test loops (F10)
  setupFiles: ['<rootDir>/test/integration/setup.ts'],
};
