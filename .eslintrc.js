module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'jest'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:jest/recommended',
    'prettier',
  ],
  rules: {
    // TypeScript specific - strict type safety
    '@typescript-eslint/explicit-function-return-type': 'off', // Let TypeScript infer return types
    '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for external API interactions
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowString: true,
        allowNumber: false,
        allowNullableObject: true,
        allowNullableBoolean: false,
        allowNullableString: true, // Allow nullable strings in conditionals
        allowNullableNumber: false,
        allowAny: true, // Allow any in conditionals for dynamic API responses
      },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Warn instead of error
    '@typescript-eslint/prefer-optional-chain': 'warn', // Warn instead of error
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', disallowTypeAnnotations: false },
    ],
    '@typescript-eslint/no-unsafe-assignment': 'warn', // Warn for dynamic imports
    '@typescript-eslint/no-unsafe-member-access': 'warn', // Warn for external API access
    '@typescript-eslint/no-unsafe-call': 'warn', // Warn for dynamic calls
    '@typescript-eslint/no-unsafe-return': 'warn', // Warn for dynamic returns
    '@typescript-eslint/restrict-template-expressions': [
      'warn',
      { allowNumber: true, allowBoolean: true, allowAny: true, allowNullish: true },
    ],
    '@typescript-eslint/require-await': 'off', // Allow async functions without await for future compatibility

    // General code quality
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-throw-literal': 'error',

    // Jest rules - allow conditional expects for Result type patterns
    'jest/no-conditional-expect': 'off',
  },
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['dist', 'node_modules', '*.js'],
};
