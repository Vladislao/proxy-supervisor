const url = require("url");

const fulfill = proxy => {
  if (proxy.slashes) return proxy;
  return url.parse(`http://${proxy.href}`);
};

const parse = address => {
  if (address instanceof url.Url) return fulfill(address);
  return fulfill(url.parse(address));
};

module.exports.parse = parse;
