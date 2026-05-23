module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist/', 'node_modules/'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Quality gates aligned with apuntes_calidad — cyclomatic complexity is the only
    // blocking metric explicitly prescribed by the professor (max 15 per function).
    // The remaining size/depth/param thresholds are warnings: they surface drift
    // without blocking on edge cases (NestJS constructors with multiple DI deps,
    // orchestration use-cases with sequential phases).
    complexity: ['error', 15],
    'max-depth': ['warn', 4],
    'max-params': ['warn', 5],
    'max-lines-per-function': [
      'warn',
      { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
    ],
  },
  overrides: [
    {
      // Tests follow Arrange-Act-Assert blocks that can be longer than production code.
      // Relax size/depth here; complexity stays blocking everywhere.
      files: ['test/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
      rules: {
        'max-lines-per-function': 'off',
        'max-depth': 'off',
      },
    },
  ],
};
