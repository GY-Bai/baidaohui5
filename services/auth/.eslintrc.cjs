module.exports = {
  root: true,
  extends: [
    "@kit/eslint-config",
  ],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  settings: {
    next: {
      rootDir: "apps/web/apps/web",
    },
  },
}; 