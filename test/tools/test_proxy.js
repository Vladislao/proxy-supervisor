const request = require('request').defaults({ agentOptions: { rejectUnauthorized: false } });

const def = (req, res) => req.pipe(request(req.url)).on('error', (e) => { console.error(e); res.end('NOT OK!'); }).pipe(res);

module.exports = (protocol, fn = def) => {
  const server = protocol.createServer((req, res) => {
    const address = server.address();
    req.headers['request-chain'] += ` -> ${address.address}:${address.port}`;
    fn(req, res, server);
  });
  return server;
};
