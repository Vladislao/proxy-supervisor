const http = require('http');

const def = (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (data) => { body += data; });
    req.on('end', () => {
      res.end('OK');
    });
    return res;
  }

  return res.end('OK');
};

module.exports = (fn = def) => {
  const server = http.createServer((req, res) => {
    const address = server.address();
    res.setHeader('request-chain', `${req.headers['request-chain']} -> ${address.address}:${address.port}`);
    fn(req, res, server);
  });
  return server;
};
