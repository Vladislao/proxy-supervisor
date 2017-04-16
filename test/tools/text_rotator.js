const http = require('http');
const fs = require('fs');
const balancer = require('../../lib/balancer');

const proxies = fs.readFileSync('./test/proxy.txt', 'utf-8').split('\n').map(x => x.trim()).filter(x => x);
const server = http.createServer(balancer().add(proxies).proxy());

module.exports = server;
