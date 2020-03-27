const { finished } = require("stream");
const http = require("http");

module.exports.connect = options =>
  new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      method: "CONNECT",
      ...options
    });
    request.once("connect", (res, socket, head) => {
      resolve({ res, socket, head });
    });
    request.once("error", err => {
      reject(err);
    });
    request.setTimeout(1000, () => {
      request.destroy(new Error("REQUEST TIMEOUT"));
    });
    request.end();
  });

module.exports.request = request =>
  new Promise((resolve, reject) => {
    finished(request, err => {
      if (err) return reject(err);
    });
    request.once("error", err => {
      reject(err);
    });
    request.once("response", res => {
      resolve(res);
    });
    request.setTimeout(1000, () => {
      request.destroy(new Error("REQUEST TIMEOUT"));
    });
    request.end();
  });
