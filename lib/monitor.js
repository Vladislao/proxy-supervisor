const promisify = require('js-promisify');
const request = require('request');
const Publisher = require('./core/publisher');

module.exports = class Monitor extends Publisher {
  constructor({ interval = 5 * 60 * 1000, target = 'http://requestb.in' } = {}) {
    super();

    this.interval = interval;
    this.target = target;

    setTimeout(() => { this.check(); }, this.interval);
  }

  check() {
    const merged = super.listeners.reduce((acc, l) => Object.assign(acc, l.proxies), {});
    const proxies = Object.values(merged).map(p => p.url);

    Promise.all(
      proxies.map(p => promisify(request, [{
        method: 'GET',
        uri: this.target,
        proxy: p.url.href
      }]))
    ).then((results) => {
      console.log(results);
      console.log(results[0]);
      setTimeout(() => { this.check(); }, this.interval);
    });
  }
};
