import baseConfig from './eslint.base.mjs';

/**
 * Web-specific ESLint configuration enforcing ADR 0005 boundary rules.
 * Strictly forbids any import of @repo/database into apps/web.
 * @type {import('eslint').Linter.Config[]}
 */
export const webConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@repo/database',
              message:
                'CRITICAL INVARIANT (ADR 0005): apps/web must NEVER import from @repo/database. Access data exclusively via typed HTTP/JSON API requests to apps/api.',
            },
          ],
          patterns: [
            {
              group: ['*database*', '**/packages/database/**', '**/packages/database'],
              message:
                'CRITICAL INVARIANT (ADR 0005): Direct imports from database packages are strictly forbidden in apps/web.',
            },
          ],
        },
      ],
    },
  },
];

export default webConfig;
