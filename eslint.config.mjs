import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const typescriptImports = {
  regex: '^\\.{1,2}/.*\\.(?:[cm]?js|jsx)$',
  message:
    'Use .ts source imports; TypeScript rewrites them when emitting JavaScript.'
}

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'storage/**',
      '.yarn/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      'no-console': 'error',
      'no-restricted-imports': ['error', { patterns: [typescriptImports] }]
    }
  },
  {
    files: ['src/domains/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            typescriptImports,
            {
              group: [
                '../*/controller.ts',
                '../*/routes.ts',
                '../*/service.ts',
                '../*/repository.ts',
                '../*/model.ts',
                '../*/middleware.ts',
                '../*/transformer.ts',
                '../*/utils.ts',
                '../*/image.ts',
                '../*/preparation.ts',
                '../*/renderer.ts',
                '../*/upload.ts',
                '../*/mailer.ts',
                '../*/delivery/**',
                '../*/verification/**'
              ],
              message:
                'Use the domain index.ts API or its public dto.ts/schemas.ts contracts.'
            },
            {
              regex:
                '^(?:\\.\\./){2,}(?:auth|users|media|notifications)/(?!index\\.ts$|dto\\.ts$|schemas\\.ts$)',
              message:
                'Nested features must use another domain through its index.ts, dto.ts, or schemas.ts.'
            }
          ]
        }
      ]
    }
  },
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  prettier
)
