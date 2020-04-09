const http = require("http");
const { pipeline } = require("stream");
const requestDebug = require("debug")("proxy-supervisor:proxy:request");
const connectDebug = require("debug")("proxy-supervisor:proxy:connect");

const request = (options, clientReq, clientRes, callback) => {
  let finished = false;
  const targetReq = http.request(options);

  targetReq.once("timeout", () => {
    requestDebug("timeout triggered");
    targetReq.destroy(new Error("TIMEOUT"));
  });

  targetReq.once("response", targetRes => {
    requestDebug(
      "response triggered with %d status code",
      targetRes.statusCode
    );

    clientRes.writeHead(
      targetRes.statusCode,
      targetRes.statusMessage,
      targetRes.headers
    );

    return pipeline(targetRes, clientRes, () => {
      requestDebug("response pipeline finished");

      if (finished) return;
      return callback(null, targetRes);
    });
  });

  targetReq.once("error", err => {
    requestDebug("error triggered %s", err.message);

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
    requestDebug("request pipeline finished");
  });
};

const connect = (options, clientSocket, head, callback) => {
  const targetReq = http.request(options);

  targetReq.once("timeout", () => {
    connectDebug("timeout triggered");
    targetReq.destroy(new Error("TIMEOUT"));
  });

  targetReq.once("connect", (targetRes, targetSocket) => {
    connectDebug("connect triggered with %d status code", targetRes.statusCode);

    if (targetRes.statusCode < 200 || targetRes.statusCode >= 300) {
      targetSocket.end();
      clientSocket.end(
        `HTTP/1.1 ${targetRes.statusCode} ${targetRes.statusMessage}\r\n\r\n`
      );
      return callback(null, targetRes);
    }

    clientSocket.write(`HTTP/1.1 200 Connection Established\r\n\r\n`);
    targetSocket.write(head);

    return pipeline(clientSocket, targetSocket, clientSocket, err => {
      if (err) {
        connectDebug("response pipeline finished with error %s", err.message);
        return callback(err);
      } else {
        connectDebug("response pipeline finished");
        return callback(null, targetRes);
      }
    });
  });

  targetReq.once("error", err => {
    connectDebug("error triggered %s", err.message);

    clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
    return callback(err);
  });

  targetReq.end();
};

module.exports.request = request;
module.exports.connect = connect;
