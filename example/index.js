const http = require('http');
const fs = require('fs');
const vicodin = require('../lib/balancer');
const monitor = require('../lib/monitor');

const proxies = fs.readFileSync('./proxy.txt', 'utf-8').split('\n').map(x => x.trim()).filter(x => x);
const balancer = vicodin()
  .source(monitor)
  .add(proxies);

const server = http.createServer((req, res) => {
  console.log(req.url);
  return balancer.proxy()(req, res, (err) => {
    console.log(err);
  });
});

server.listen(9999);
