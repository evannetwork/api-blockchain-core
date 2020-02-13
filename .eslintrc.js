module.exports =  {
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:chai-friendly/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
  },
  plugins: [
    '@typescript-eslint',
    'chai-friendly',
  ],
  rules: {
    // note you must disable the base rule as it can report incorrect errors
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/explicit-function-return-type': ['off'],
    '@typescript-eslint/member-ordering': ['error'],
    '@typescript-eslint/no-explicit-any': ['off'],
    '@typescript-eslint/no-unused-expressions': ['off'],
    'chai-friendly/no-unused-expressions': ['error'],
    // rule additions for airbnb
    'class-methods-use-this': ['off'],  // *may* require further adjustments to instance usage
    // exclude cycle dependencies
    'import/no-cycle': ['off'],
    'no-await-in-loop': ['off'],
    'no-restricted-syntax': ['off'],
   },
};
