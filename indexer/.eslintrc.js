module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './indexer/tsconfig.json',
    sourceType: 'module',
  },
  // plugins: ['@typescript-eslint/eslint-plugin'],
  // extends: [
  //   'plugin:@typescript-eslint/recommended'
  // ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {},
};
