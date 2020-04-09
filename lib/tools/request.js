const http = require("http");
const debug = require("debug")("proxy-supervisor:request");

const request = options =>
  new Promise(resolve => {
    const req = http.request(options);

    req.once("timeout", () => {
      debug("timeout triggered");
      req.destroy(new Error("TIMEOUT"));
    });

    req.once("response", res => {
      debug("response triggered with %d status code", res.statusCode);
      resolve({ res });
    });

    req.once("error", err => {
      debug("error triggered %s", err.message);
      resolve({ err });
    });

    req.end();
  });

module.exports.request = request;
