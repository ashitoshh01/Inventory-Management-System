import baseConfig from '@repo/config/eslint.base.mjs';

export default [
  ...baseConfig,
  {
    files: ['jest.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
      },
    },
  },
];
