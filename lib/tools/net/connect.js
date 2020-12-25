const http = require("http");
const { pipeline } = require("stream");
const debug = require("debug")("proxy-supervisor:proxy:connect");

module.exports = (targetUrl, options, clientSocket, head, callback) => {
  const targetReq = http.request({
    method: "CONNECT",
    path: targetUrl.href,
    ...options
  });

  targetReq.once("timeout", () => {
    debug("timeout triggered");
    targetReq.destroy(new Error("TIMEOUT"));
  });

  targetReq.once("connect", (targetRes, targetSocket) => {
    debug("connect triggered with %d status code", targetRes.statusCode);

    if (targetRes.statusCode < 200 || targetRes.statusCode >= 300) {
      targetSocket.end();
      clientSocket.end(
        `HTTP/1.1 ${targetRes.statusCode} ${targetRes.statusMessage}\r\n\r\n`
      );
      return callback(new Error("CONNECT_NOT_OK"));
    }

    clientSocket.write(`HTTP/1.1 200 Connection Established\r\n\r\n`);
    targetSocket.write(head);

    return pipeline(clientSocket, targetSocket, clientSocket, err => {
      if (err) {
        debug("response pipeline finished with error %s", err.message);
        return callback(err);
      } else {
        debug("response pipeline finished");
        return callback(null, targetRes);
      }
    });
  });

  targetReq.once("error", err => {
    debug("error triggered %s", err.message);

    clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
    return callback(err);
  });

  targetReq.end();
};
