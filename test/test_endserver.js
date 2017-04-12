const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (data) => { body += data; });
    req.on('end', () => res.end(body));
  } else {
    return res.end('accepted');
  }
});

module.exports = server;
