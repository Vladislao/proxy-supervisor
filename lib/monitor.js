const promisify = require('js-promisify');
const request = require('request');
const Publisher = require('./core/publisher');

const STATUS_CODES = [200, 201, 202, 404];

const createRequests = (proxies, target) =>
  proxies.map(proxy =>
    promisify(request, [Object.assign({ proxy: proxy.url.href }, target)])
    .then(
      (res, body) => ({ proxy, res, body }),
      err => ({ proxy, err })
    )
  );

module.exports = class Monitor extends Publisher {
  constructor({ interval = 5 * 60 * 1000, target = { method: 'GET', uri: 'http://requestb.in' } } = {}) {
    super();

    this.interval = interval;
    this.target = target;

    this._response = (p) => {
      if (p.err) return false;
      return STATUS_CODES.some(c => c === p.res.statusCode);
    };
    this._error = (err) => { console.error(err); };

    setTimeout(() => { this.check(); }, this.interval);
  }

  check() {
    const merged = this.listeners.reduce((acc, l) => Object.assign(acc, l.proxies), {});
    const proxies = Object.values(merged).map(p => p.url);

    Promise.all(
      // send a request to target via proxies
      // wrap result to { proxy, res, body }
      // wrap error to  { proxy, err }
      createRequests(proxies, this.target)
    ).then((results) => {
      // get all bad results
      const bad = results
        .filter(p => !this._response(p))
        .map(p => p.proxy);
      // drop them from listeners
      this.listeners.forEach((listener) => {
        listener.remove(bad);
      });
    }, this._error)
    .then(() => {
      // check will be triggered again, unless you return Promise.reject() from onError callback
      setTimeout(() => { this.check(); }, this.interval);
    });
  }

  onResponse(fn) { this._response = fn; }

  onError(fn) { this._error = fn; }
};
