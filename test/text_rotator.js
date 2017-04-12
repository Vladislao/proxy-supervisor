const http = require('http');
const ProxySupervisor = require('../lib/supervisor');

const supervisor = new ProxySupervisor()
  .from('./test/proxy.txt');

const server = http.createServer(supervisor.proxy());

module.exports = server;
