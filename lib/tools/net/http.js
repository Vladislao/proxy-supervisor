const http = require("http");
const { pipeline } = require("stream");
const debug = require("debug")("proxy-supervisor:proxy:http");

module.exports = (url, options, clientReq, clientRes, callback) => {
  let finished = false;
  const targetReq = http.request({ ...options, path: url.href });

  targetReq.once("timeout", () => {
    debug("timeout triggered");
    targetReq.destroy(new Error("TIMEOUT"));
  });

  targetReq.once("response", targetRes => {
    debug("response triggered with %d status code", targetRes.statusCode);

    clientRes.writeHead(
      targetRes.statusCode,
      targetRes.statusMessage,
      targetRes.headers
    );

    return pipeline(targetRes, clientRes, () => {
      debug("response pipeline finished");

      if (finished) return;
      return callback(null, targetRes);
    });
  });

  targetReq.once("error", err => {
    debug("error triggered %s", err.message);

    finished = true;
    const writableEnded =
      clientRes.writableEnded === undefined
        ? clientRes.finished
        : clientRes.writableEnded;

    if (!writableEnded) {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502);
      }
      clientRes.end();
    }

    return callback(err);
  });

  pipeline(clientReq, targetReq, () => {
    debug("client payload sent to target");
  });
};
