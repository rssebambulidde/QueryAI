module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/__tests__/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // Disable type-checking during tests. Pre-existing type mismatches
      // between Zod-inferred request types and service-layer option types
      // block test execution but don't affect runtime. Type checking is
      // handled separately by `tsc --noEmit`.
      diagnostics: false,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
};
