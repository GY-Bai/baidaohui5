module.exports = {
  root: true,
  extends: [
    "@kit/eslint-config",
  ],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
  },
}; 