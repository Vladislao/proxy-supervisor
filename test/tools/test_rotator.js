const balancer = require("../../lib/balancer");

module.exports = (protocol, proxies) => {
  const middleware = balancer()
    .add(proxies)
    .proxy({ tunnel: false });

  const server = protocol.createServer((req, res) => {
    const address = server.address();
    req.headers["request-chain"] += ` -> ${address.address}:${address.port}`;

    middleware(req, res, e => {
      if (e) {
        console.log(e);
      }
    });
  });
  return server;
};
