const promisify = require('js-promisify');
const request = require('request');
const Publisher = require('./core/publisher');

class Monitor extends Publisher {
  constructor() {
    super();
    // by default check proxy every 5 min
    this.interval = 5 * 60 * 1000;
    // by default testing site is requestb.in
    this.target = 'http://requestb.in';

    setTimeout(this.check, this.interval);
  }

  check() {
    const merged = this.listeners.reduce((acc, l) => Object.assign(acc, l.proxies), {});
    const proxies = Object.values(merged).map(p => p.url);

    if (proxies.length === 0) {
      setTimeout(this.check, this.interval);
      return;
    }

    Promise.all(
      proxies.map(p => promisify(request, [{
        method: 'GET',
        uri: 'http://requestb.in/',
        proxy: p.url.href
      }]))
    ).then((results) => {
      console.log(results);
      console.log(results[0]);


      setTimeout(this.check, this.interval);
    });
  }
}

module.exports = new Monitor();
