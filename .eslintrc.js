module.exports = {
  parser: "babel-eslint",
  env: {
    browser: false,
    es6: true,
    node: true
  },
  extends: "eslint:recommended",
  parserOptions: {
    allowImportExportEverywhere: true,
    ecmaFeatures: {
      experimentalObjectRestSpread: true
    }
  },
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": 2
  }
};
