const { pipeline } = require("stream");
const http = require("http");
const net = require("net");
const url = require("url");

module.exports = server => {
  server.on("request", (clientReq, clientRes) => {
    const targetUrl = url.parse(clientReq.url);

    const targetReq = http.request(clientReq.url, {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      protocol: targetUrl.protocol,
      method: clientReq.method,
      headers: clientReq.headers,
      timeout: 500
    });

    targetReq.setTimeout(500, () => {
      targetReq.destroy(new Error("TIMEOUT"));
    });

    targetReq.once("response", targetRes => {
      targetRes.setTimeout(500, () => {
        targetRes.destroy(new Error("TIMEOUT"));
      });
      clientRes.writeHead(
        targetRes.statusCode,
        targetRes.statusMessage,
        targetRes.headers
      );
      pipeline(targetRes, clientRes, () => {});
    });

    pipeline(clientReq, targetReq, err => {
      if (err) {
        // should be handled by rotator
        setTimeout(() => {
          const writableEnded =
            clientRes.writableEnded === undefined
              ? clientRes.finished
              : clientRes.writableEnded;

          if (!writableEnded) {
            clientRes.writeHead(500);
            clientRes.end();
          }
        }, 1000);
      }
    });
  });

  server.on("connect", (req, clientSocket, head) => {
    // Connect to an origin server
    const { port, hostname } = url.parse(req.url);
    const serverSocket = net.connect(port || 80, hostname, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      serverSocket.write(head);

      pipeline(serverSocket, clientSocket, serverSocket, () => {
        // no handle for errors on purpose
      });
    });

    serverSocket.once("error", () => {
      setTimeout(() => {
        // should be handled by rotator
        clientSocket.destroy();
      }, 1000);
    });

    serverSocket.setTimeout(1000, () => {
      serverSocket.destroy(new Error("TIMEOUT"));
    });
  });

  return server;
};
