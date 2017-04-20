const http = require('http');
const request = require('request');

const def = (req, res) => req.pipe(request(req.url)).pipe(res);

module.exports = (fn = def) => {
  const server = http.createServer((req, res) => {
    const address = server.address();
    req.headers['request-chain'] += ` -> ${address.address}:${address.port}`;
    fn(req, res, server);
  });
  return server;
};
