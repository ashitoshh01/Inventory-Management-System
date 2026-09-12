module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/.*(@nestjs\\+jwt|jsonwebtoken)|@nestjs/jwt|jsonwebtoken))',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@repo/database$': '<rootDir>/../../packages/database/src/index.ts',
    '^@repo/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
};
