const { parse } = require("url");
const handleHTTP = require("./http");
const handleHTTPS = require("./https");
const handleConnect = require("./connect");

exports.request = (targetUrl, options, clientReq, clientRes, callback) => {
  const url = parse(targetUrl);

  if (url.protocol === "http:") {
    handleHTTP(url, options, clientReq, clientRes, callback);
  } else if (url.protocol === "https:") {
    handleHTTPS(url, options, clientReq, clientRes, callback);
  } else {
    callback(new Error("PROTOCOL_NOT_SUPPORTED"));
  }
};

exports.connect = (targetUrl, options, clientSocket, head, callback) => {
  handleConnect(parse(targetUrl), options, clientSocket, head, callback);
};
