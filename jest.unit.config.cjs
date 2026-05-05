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
    'src/dispatch/**/*.ts',
    'src/safe-points/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.schema.ts',
    '!src/main.ts',
    '!src/app.module.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 80,
    },
  },
};
