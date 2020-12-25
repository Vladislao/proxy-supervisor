const http = require("http");
const https = require("https");
const { pipeline } = require("stream");
const debug = require("debug")("proxy-supervisor:proxy:https");

module.exports = (uri, options, clientReq, clientRes, callback) => {
  const tunnelReq = http.request({
    method: "CONNECT",
    hostname: options.hostname,
    port: options.port,
    path: uri.href,
    timeout: options.timeout,
    agent: options.agent
  });

  tunnelReq.once("timeout", () => {
    debug("connect timeout triggered");
    tunnelReq.destroy(new Error("TIMEOUT"));
  });
  tunnelReq.once("connect", (tunnelRes, tunnel) => {
    debug("connected with %d status code", tunnelRes.statusCode);

    if (tunnelRes.statusCode < 200 || tunnelRes.statusCode >= 300) {
      clientRes.writeHead(tunnelRes.statusCode);
      clientRes.end();
      return callback(new Error("CONNECT_NOT_OK"));
    }

    let finished = false;
    const targetReq = https.request({
      ...options,
      headers: {
        ...options,
        host: uri.host
      },
      hostname: uri.hostname,
      port: uri.port,
      path: uri.path,
      socket: tunnel,
      rejectUnauthorized: false,
      agent: false
    });

    targetReq.once("timeout", () => {
      debug("request timeout triggered");
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
        clientRes.writeHead(502);
        clientRes.end();
      }

      return callback(err);
    });

    pipeline(clientReq, targetReq, () => {
      debug("client payload sent to target");
    });
  });

  tunnelReq.once("error", err => {
    debug("connect error triggered %s", err.message);

    clientRes.writeHead(502);
    clientRes.end();

    return callback(err);
  });

  tunnelReq.end();
};
