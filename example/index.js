const http = require('http');
const ProxySupervisor = require('../lib/supervisor');

const supervisor = new ProxySupervisor()
  .from('./proxy.txt');

const middleware = supervisor.proxy();
const server = http.createServer((req, res) => {
  console.log(req.url);
  return middleware(req, res, (e) => {
    console.error(e);
  });
});

// load proxies before starting a server
supervisor.initialize().then(() => {
  server.listen(9999);
});
