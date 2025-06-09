const http = require("http");
const debug = require("debug")("proxy-supervisor:test:request");

module.exports.connect = options =>
  new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      method: "CONNECT",
      ...options
    });
    request.once("connect", (res, socket, head) => {
      debug("connect recieved with %d status code", res.statusCode);
      resolve({ res, socket, head });
    });
    request.once("error", err => {
      debug("connect error triggered %s", err.message);
      reject(err);
    });
    request.setTimeout(1000, () => {
      request.destroy(new Error("REQUEST TIMEOUT"));
    });
    request.end();
  });

module.exports.request = request =>
  new Promise((resolve, reject) => {
    request.once("error", err => {
      debug("request error triggered %s", err.message);
      reject(err);
    });
    request.once("response", res => {
      debug("response recieved with %d status code", res.statusCode);
      let body = "";
      res.on("data", chunk => {
        body += chunk;
      });
      res.once("end", () => {
        debug("response end triggered");
        res.body = body;
        resolve(res);
      });
      res.once("aborted", () => {
        debug("response aborted");
        reject(new Error("RESPONSE ABORTED"));
      });
    });

    request.setTimeout(1000, () => {
      request.destroy(new Error("REQUEST TIMEOUT"));
    });
    request.end();
  });
