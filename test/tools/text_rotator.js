const http = require('http');
const fs = require('fs');
const balancer = require('../../lib/balancer');

const proxies = fs.readFileSync('./test/proxy.txt', 'utf-8').split('\n').map(x => x.trim()).filter(x => x);
const middleware = balancer()
  .add(proxies)
  .proxy();

const server = http.createServer((req, res) => {
  const address = server.address();
  req.headers['request-chain'] += ` -> ${address.address}:${address.port}`;

  middleware(req, res);
});

module.exports = server;
