const url = require('url');

module.exports = class ProxyNode {
  constructor(address) {
    this.update(address);
  }

  update(address) {
    this.url = url.parse(address);
    if (this.url.protocol === null) this.url = url.parse(`http://${address}`);
  }

  toString() {
    return this.url.host;
  }
};
