/* eslint no-console: "off" */

const chai = require("chai");
const spies = require("chai-spies");
const promises = require("chai-as-promised");

chai.use(spies);
chai.use(promises);

process.on("uncaughtException", err => {
  console.log("uncaughtException");
  console.log(err);
});
process.on("unhandledRejection", err => {
  console.log("unhandledRejection");
  console.log(err);
});
