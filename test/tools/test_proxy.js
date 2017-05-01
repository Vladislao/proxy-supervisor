const request = require('request').defaults({ rejectUnauthorized: false, strictSSL: false });
const url = require('url');
const net = require('net');

const def = (req, res) => req.pipe(request(req.url))
            .on('error', (e) => { console.error(e); res.end('NOT OK!'); })
            .pipe(res);

module.exports = (protocol, fn = def) => {
  const server = protocol.createServer((req, res) => {
    const address = server.address();
    req.headers['request-chain'] += ` -> ${address.address}:${address.port}`;
    fn(req, res, server);
  });
  server.on('connect', (req, client, head) => {
    const u = url.parse(req.url);
    const socket = net.connect(u.host, u.port, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      socket.write(head);
      socket.pipe(client);
      client.pipe(socket);
    });
  });
  return server;
};
