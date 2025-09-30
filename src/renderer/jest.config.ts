import type { JestConfigWithTsJest } from 'ts-jest';

export const config: JestConfigWithTsJest = {
  clearMocks: true,
  testTimeout: 10000,
  // Run tests serially (one at a time) for better CI debugging
  maxWorkers: 1,
  // Show verbose output to see which test is running
  verbose: process.env.CI ? true : false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.pacttest.ts', // Exclude pacttest files
    '!**/test-helpers/**', // Exclude test helpers
    '!**/*.json',
    '!?(**)/?(*.|*-)types.ts',
    '!**/models/*',
    '!**/__snapshots__/*',
    '!**/scripts/*',
  ],
  coverageDirectory: './coverage',
  coverageReporters: [
    'clover',
    'json',
    'lcov',
    ['text', { skipFull: true }],
    'json-summary',
  ],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      lines: 0,
      functions: 0,
    },
  },
  moduleDirectories: ['node_modules', 'src'],
  modulePathIgnorePatterns: ['dist'],
  // Skip LimitedMediaPlayer test in CI environments
  // testPathIgnorePatterns: process.env.CI
  //  ? ['**/LimitedMediaPlayer.test.tsx']
  //  : [],
  testPathIgnorePatterns: [],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // runs before each test file
  // Mock static file imports (CSS, images, etc.)
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // Mock CSS files
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.ts', // Mock image files
    '^../api-variable$': '<rootDir>/__mocks__/api-variable.tsx', // Mock api-variable
    '^../../api-variable$': '<rootDir>/__mocks__/api-variable.tsx', // Mock api-variable
  },
};

export default config;
