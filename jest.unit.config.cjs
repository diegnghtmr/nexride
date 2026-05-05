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
    'src/dispatch/infrastructure/providers/**/*.ts',
    'src/safe-points/safe-points.service.ts',
    '!src/**/*.module.ts',
    '!src/**/*.entity.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    'src/dispatch/domain/**/*.ts': { statements: 85, branches: 80 },
    'src/dispatch/infrastructure/providers/**/*.ts': { statements: 85, branches: 80 },
    'src/safe-points/safe-points.service.ts': { statements: 85, branches: 80 },
  },
};
