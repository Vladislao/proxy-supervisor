const http = require('http');
const request = require('request');

const server = http.createServer((req, res) => req.pipe(request(req.url)).pipe(res));

module.exports = server;
