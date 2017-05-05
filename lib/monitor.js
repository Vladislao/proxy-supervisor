const promisify = require('js-promisify');
const request = require('request');
const Source = require('./core/source');

/*
  Valid status codes from target server
*/
const STATUS_CODES = [200, 201, 202];

/*
  Returns array of promises. Each one is a request to target via proxy.

  Each promise returns { proxy, res, body } in case of response and { proxy, err }
  in case of error.
*/
const createRequests = (proxies, target) =>
  proxies.map((proxy) => {
    const options = Object.assign({ method: 'GET' }, target, { proxy: proxy.href });
    return promisify(request, [options])
          .then(
            (res, body) => ({ proxy, res, body }),
            err => ({ proxy, err })
          );
  });

/*
  Monitors dead and slow proxies and filters them out from balancers.

  Constructor accepts an object with parameters to override defaults:
  * `interval` - specifies how much time should pass after last check is completed. Defaults to 5 minutes.
  * `target`   - an option for request (https://github.com/request/request) to be used. You can specify
                 your own `uri` or `timeout`. The only parameter, that will be overriden, is `proxy`. By default
                 all requests will be sent to requestb.in, lol.
*/
const Monitor = class Monitor extends Source {
  constructor({ interval = 5 * 60 * 1000, target = { method: 'GET', uri: 'http://requestb.in' } } = {}) {
    super();

    this.interval = interval;
    this.target = target;
    this._timeout = null;

    this._response = (err, proxy, res) => {
      if (err) return false;
      return STATUS_CODES.some(c => c === res.statusCode);
    };

    this.start();
  }

  /*
    Use only in case you need to stop monitoring manually.

    Monitor is started automatically on creation and can work
    with empty list of listeners.
  */
  start() {
    if (this._timeout) return;
    if (this.interval < 0) this.interval = 5 * 60 * 1000;

    const self = this;
    function endless() {
      self.check().then(() => {
        if (self._timeout) self._timeout = setTimeout(endless, self.interval);
      });
    }
    this._timeout = setTimeout(endless, this.interval);
  }

  stop() {
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = null;
  }

  /*
    Checks proxies. Returns promise, which resolves into an array of dead proxies.
  */
  check() {
    const proxies = this.proxies();

    return Promise.all(createRequests(proxies, this.target))
      .then((results) => {
        const dead = results
          .filter(p => !this._response(p.err, p.proxy, p.res, p.body))
          .map(p => p.proxy);

        if (dead.length === 0) return [];
        // drop them from listeners
        this.listeners.forEach((listener) => {
          listener.remove(dead);
        });

        return dead;
      });
  }

  /*
    You can specify your own handler for proxies.

    Function will receive `{ proxy, res, body }` in case of response and `{ proxy, err }`
    in case of error. Should return `true` for good proxy and `false` for bad.
  */
  onResponse(fn) { this._response = fn; }
};

/**
 * Export default singleton.
 *
 * @api public
 */
let instance = null;
module.exports = () => {
  if (instance === null) instance = new Monitor();
  return instance;
};

/**
 * Expose constructor.
 */
module.exports.Monitor = Monitor;
