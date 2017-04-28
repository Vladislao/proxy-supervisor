const fs = require('fs');
const balancer = require('../../lib/balancer');

module.exports = (protocol) => {
  const proxies = fs.readFileSync('./test/proxy.txt', 'utf-8').split('\n').map(x => x.trim()).filter(x => x);
  const middleware = balancer()
    .add(proxies)
    .proxy();

  const server = protocol.createServer((req, res) => {
    const address = server.address();
    req.headers['request-chain'] += ` -> ${address.address}:${address.port}`;

    middleware(req, res);
  });
  return server;
};
