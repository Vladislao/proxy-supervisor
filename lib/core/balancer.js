const http = require("http");
const debug = require("debug")("proxy-supervisor:core:balancer");

const { parse } = require("../tools/url");
const { request, connect } = require("../tools/net");

const noop = () => {};

const omit = (obj, keys) => {
  const res = { ...obj };
  keys.forEach(v => {
    delete res[v];
  });
  return res;
};

class Balancer {
  constructor() {
    this.meta = {};
    this.proxies = new Map();
    this.agent = new http.Agent({ keepAlive: true, maxFreeSockets: 1024 });
  }

  _init(proxy) {
    return proxy;
  }

  _error() {}

  _response() {}

  _next() {
    throw new Error("NO_NEXT_PROVIDED");
  }

  add(proxies) {
    (Array.isArray(proxies) ? proxies : [proxies])
      .map(parse)
      .filter(p => p.host)
      .forEach(p => {
        if (this.proxies.has(p.host)) {
          this.proxies.get(p.host).url = p;
        } else {
          this.proxies.set(p.host, this._init({ url: p }));
        }
      });

    return this;
  }

  remove(proxies) {
    (Array.isArray(proxies) ? proxies : [proxies])
      .map(parse)
      .filter(p => p.host)
      .forEach(p => {
        if (this.proxies.has(p.host)) {
          this.proxies.delete(p.host);
        }
      });

    return this;
  }

  subscribe(source) {
    source.addListener(this);
    return this;
  }

  proxy(options = {}) {
    const {
      timeout = 30000,
      targetHeader = "proxy-target-url",
      formatHeaders = (_proxy, headers) => headers
    } = options;

    return (clientReq, clientRes, next) => {
      const targetUrl = clientReq.headers[targetHeader] || clientReq.url;

      debug("proxy request for %s", targetUrl);

      const _next = next || noop;
      const proxy = this._next(
        Array.from(this.proxies.values()),
        targetUrl,
        clientReq
      );

      if (proxy === null) {
        debug("proxy list is empty");

        clientRes.writeHead(502);
        clientRes.end();

        return _next(new Error("NO_PROXY_AVAILABLE"));
      }

      clientReq.proxy = proxy;
      debug("selected %s as proxy", proxy.url.href);

      return request(
        targetUrl,
        {
          hostname: proxy.url.hostname,
          port: proxy.url.port,
          method: clientReq.method,
          headers: formatHeaders(
            proxy,
            omit(clientReq.headers, [targetHeader])
          ),
          agent: this.agent,
          timeout
        },
        clientReq,
        clientRes,
        (err, targetRes) => {
          if (err) {
            this._error(proxy, targetUrl, err, clientReq);
            return _next(err);
          }
          this._response(proxy, targetUrl, targetRes, clientReq);
          return _next();
        }
      );
    };
  }

  connect(options = {}) {
    const {
      timeout = 30000,
      formatHeaders = (_proxy, headers) => headers
    } = options;

    return (clientReq, clientSocket, head, next) => {
      debug("connect request for %s", clientReq.url);

      const _next = next || noop;
      const proxy = this._next(
        Array.from(this.proxies.values()),
        clientReq.url,
        clientReq
      );

      if (proxy === null) {
        debug("proxy list is empty");

        clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);

        return _next(new Error("NO_PROXY_AVAILABLE"));
      }

      clientReq.proxy = proxy;
      debug("selected %s as proxy", proxy.url.href);

      return connect(
        clientReq.url,
        {
          hostname: proxy.url.hostname,
          port: proxy.url.port,
          headers: formatHeaders(proxy, clientReq.headers),
          agent: this.agent,
          timeout
        },
        clientSocket,
        head,
        (err, targetRes) => {
          if (err) {
            this._error(proxy, clientReq.url, err, clientReq);
            return _next(err);
          }
          this._response(proxy, clientReq.url, targetRes, clientReq);
          return _next();
        }
      );
    };
  }

  onNext(fn) {
    this._next = fn;
    return this;
  }
  onAdd(fn) {
    this._init = fn;
    return this;
  }
  onResponse(fn) {
    this._response = fn;
    return this;
  }
  onError(fn) {
    this._error = fn;
    return this;
  }
}

module.exports.default = Balancer;
