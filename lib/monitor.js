const http = require("http");

const Source = require("./core/source").default;

/*
  Returns array of promises. Each one is a request to target via proxy.

  Each promise returns { proxy, res } in case of response and { proxy, err } in case of error.
*/
const createRequests = (proxies, options = {}) => {
  const { timeout = 3000, target } = options;

  return proxies.map(
    proxy =>
      new Promise(resolve => {
        const request = http.request({
          hostname: proxy.hostname,
          port: proxy.port,
          auth: proxy.auth,
          path: target,
          timeout: timeout
        });

        request.setTimeout(timeout, () => {
          request.destroy(new Error("TIMEOUT"));
        });

        request.once("response", res => resolve({ proxy, res }));
        request.once("error", err => resolve({ proxy, err }));

        request.end();
      })
  );
};

/*
  Monitors dead and slow proxies and filters them out from balancers.

  Constructor accepts an object with parameters:
  * `target`   - specify path for the request to be done via proxies.
  * `interval` - (optinal) specifies how much time should pass after last check is completed. Defaults to 5 minutes.
  * `timeout` - (optinal) specifies connection timeout for requests. Defaults to 3 seconds.
*/
class Monitor extends Source {
  constructor({ target, interval = 5 * 60 * 1000, timeout = 3000 } = {}) {
    super();

    if (!target) throw new Error("'target' must be specified");

    this.options = { target, timeout };
    this.interval = interval;
    this._timeout = null;

    this.start();
  }

  _response({ err, res }) {
    if (err) return false;
    return res.statusCode === 200;
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

    return Promise.all(createRequests(proxies, this.options)).then(results => {
      const dead = results.filter(v => !this._response(v)).map(v => v.proxy);

      if (dead.length === 0) return [];
      // drop them from listeners
      this.listeners.forEach(listener => {
        listener.remove(dead);
      });

      return dead;
    });
  }

  /*
    You can specify your own handler for proxies.

    Function will receive `{ proxy, res }` in case of response and `{ proxy, err }`
    in case of error. Should return `true` for good proxy and `false` for bad ones.
  */
  onResponse(fn) {
    this._response = fn;
  }
}

/**
 * Export default singleton.
 *
 * @api public
 */
let instance = null;
module.exports.default = options => {
  if (instance === null) instance = new Monitor(options);
  return instance;
};

/**
 * Resets singleton.
 */
module.exports.reset = () => {
  instance = null;
};

/**
 * Expose constructor.
 */
module.exports.Monitor = Monitor;
