import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.js', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Strict rules for all TypeScript files
    files: ['**/*.ts'],
    rules: {
      // Enforce explicit return types for better documentation (warn for gradual adoption)
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],

      // Enforce explicit accessibility modifiers (warn for existing codebase)
      '@typescript-eslint/explicit-member-accessibility': [
        'warn',
        {
          accessibility: 'explicit',
          overrides: {
            constructors: 'no-public',
          },
        },
      ],

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'property',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'classProperty',
          modifiers: ['static', 'readonly'],
          format: ['UPPER_CASE', 'camelCase'],
        },
      ],

      // Strict null checks (warn to allow gradual adoption)
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Allow type assertions instead of ! assertions (project uses 'as Type' pattern)
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',

      // Prevent unused variables (warn for gradual adoption)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Require consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],

      // Enforce consistent type exports
      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],

      // Prevent floating promises (warn for gradual adoption)
      '@typescript-eslint/no-floating-promises': 'warn',

      // Require await for async functions
      '@typescript-eslint/require-await': 'warn',

      // Prevent misused promises
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],

      // Strict boolean expressions (relaxed for existing codebase)
      '@typescript-eslint/strict-boolean-expressions': 'off',

      // Prevent unnecessary type assertions
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // Prevent unsafe operations (warn for gradual adoption)
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      // Method signature style
      '@typescript-eslint/method-signature-style': ['error', 'method'],

      // Array type style
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      // Prevent redundant type constituents
      '@typescript-eslint/no-redundant-type-constituents': 'error',

      // Prefer nullish coalescing (off for existing codebase)
      '@typescript-eslint/prefer-nullish-coalescing': 'off',

      // Prefer optional chain
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // Prefer for-of - warn only
      '@typescript-eslint/prefer-for-of': 'warn',

      // No explicit any (warn for gradual adoption)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Inferrable types - allow them for readability
      '@typescript-eslint/no-inferrable-types': 'off',

      // Allow utility classes with only static methods
      '@typescript-eslint/no-extraneous-class': 'off',

      // Deprecation warnings - off to allow using eslint flat config
      '@typescript-eslint/no-deprecated': 'off',

      // Allow dynamic delete for test mocks
      '@typescript-eslint/no-dynamic-delete': 'warn',

      // Promise reject errors - warn only
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',

      // Void expressions in arrow functions - off for tests
      '@typescript-eslint/no-confusing-void-expression': 'off',

      // Allow case declarations
      'no-case-declarations': 'off',

      // Allow useless constructors that call super()
      '@typescript-eslint/no-useless-constructor': 'warn',

      // Template expressions - allow numbers
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
        },
      ],

      // Standard ESLint rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
      'no-debugger': 'error',
      // Allow alerts for user interaction in this UI app
      'no-alert': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'warn',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  {
    // Special rules for AudioEngine - per CLAUDE.md, console.log must be preserved
    files: ['**/AudioEngine.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Special rules for PresetManager - has intentional console.log for debugging
    files: ['**/PresetManager.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Relaxed rules for test files
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Relaxed rules for config files
    files: ['*.config.ts', '*.config.js', 'vite.config.ts', 'vitest.config.ts', 'eslint.config.js'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Allow HTTP header names like 'Cross-Origin-Opener-Policy'
      '@typescript-eslint/naming-convention': 'off',
      // Allow deprecated config method in eslint config
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  {
    // Ignore patterns
    ignores: ['dist/**', 'node_modules/**', 'public/ffmpeg/**', 'cli/**', '*.d.ts', 'coverage/**'],
  }
);
