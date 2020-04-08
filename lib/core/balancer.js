const http = require("http");
const { pipeline } = require("stream");
const debug = require("debug")("proxy-supervisor:core:balancer");

const { parse } = require("../tools/url");

const noop = () => {};

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
    const { timeout = 30000 } = options;

    return (clientReq, clientRes, next) => {
      debug("proxy request for %s", clientReq.url);

      let handled = false;
      const _next = next || noop;

      const proxy = this._next(Array.from(this.proxies.values()), clientReq);

      if (proxy === null) {
        debug("proxy list is empty");

        clientRes.writeHead(502);
        clientRes.end();

        return _next(new Error("NO_PROXY_AVAILABLE"));
      }

      clientReq.proxy = proxy;

      debug("selected %s as proxy", proxy.url.href);
      const targetReq = http.request({
        hostname: proxy.url.hostname,
        port: proxy.url.port,
        method: clientReq.method,
        headers: clientReq.headers,
        path: clientReq.url,
        timeout,
        agent: this.agent
      });

      targetReq.once("timeout", () => {
        debug("request timeout triggered");
        targetReq.destroy(new Error("TIMEOUT"));
      });

      targetReq.once("response", targetRes => {
        debug("received response with %d status code", targetRes.statusCode);

        clientRes.writeHead(
          targetRes.statusCode,
          targetRes.statusMessage,
          targetRes.headers
        );

        pipeline(targetRes, clientRes, () => {
          if (handled) return;

          debug("response pipeline finished");
          this._response(proxy, targetRes, clientReq);

          return _next();
        });
      });

      targetReq.once("error", err => {
        debug("request error triggered %s", err.message);

        handled = true;
        const writableEnded =
          clientRes.writableEnded === undefined
            ? clientRes.finished
            : clientRes.writableEnded;

        if (!writableEnded) {
          clientRes.writeHead(502);
          clientRes.end();
        }

        this._error(proxy, err, clientReq);
        return _next(err);
      });

      pipeline(clientReq, targetReq, () => {
        debug("request pipeline finished");
      });
    };
  }

  connect(options = {}) {
    const { timeout = 30000 } = options;
    return (clientReq, clientSocket, head, next) => {
      debug("connect request for %s", clientReq.url);

      const _next = next || noop;
      const proxy = this._next(Array.from(this.proxies.values()), clientReq);

      if (proxy === null) {
        debug("proxy list is empty");
        clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
        return _next(new Error("NO_PROXY_AVAILABLE"));
      }

      clientReq.proxy = proxy;

      const targetReq = http.request({
        hostname: proxy.url.hostname,
        port: proxy.url.port,
        headers: clientReq.headers,
        method: "CONNECT",
        path: clientReq.url,
        timeout,
        agent: this.agent
      });

      targetReq.once("timeout", () => {
        debug("request timeout triggered");
        targetReq.destroy(new Error("TIMEOUT"));
      });

      targetReq.once("connect", (targetRes, targetSocket) => {
        debug("received connect with %d status code", targetRes.statusCode);
        if (targetRes.statusCode >= 200 && targetRes.statusCode < 300) {
          clientSocket.write(`HTTP/1.1 200 Connection Established\r\n\r\n`);
          targetSocket.write(head);

          return pipeline(clientSocket, targetSocket, clientSocket, err => {
            if (err) {
              debug("response pipeline finished with error %s", err.message);
              this._error(proxy, err, clientReq);
              return _next(err);
            } else {
              debug("response pipeline finished");
              return _next();
            }
          });
        } else {
          targetSocket.end();
          clientSocket.end(
            `HTTP/1.1 ${targetRes.statusCode} ${targetRes.statusMessage}\r\n\r\n`
          );
          return _next();
        }
      });

      targetReq.once("error", err => {
        debug("request error triggered %s", err.message);

        clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
        this._error(proxy, err, clientReq);

        return _next(err);
      });

      targetReq.end();
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
