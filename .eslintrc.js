module.exports =  {
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    // note you must disable the base rule as it can report incorrect errors
    'indent': 'off',
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/explicit-function-return-type': ['off'],
    '@typescript-eslint/no-explicit-any': ['off'],
    '@typescript-eslint/camelcase': ['off'],
    '@typescript-eslint/no-empty-interface': ['off'],
  },
};
