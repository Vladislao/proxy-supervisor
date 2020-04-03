const http = require("http");
const url = require("url");
const { pipeline } = require("stream");

const noop = () => {};

const fulfill = proxy => {
  if (proxy.slashes) return proxy;
  return url.parse(`http://${proxy.href}`);
};

const parse = address => {
  if (address instanceof url.Url) return fulfill(address);
  return fulfill(url.parse(address));
};

class Balancer {
  constructor() {
    this.proxies = new Map();
    this.agent = new http.Agent({ keepAlive: true, maxFreeSockets: 1024 });

    this._init = proxy => proxy;
    this._error = () => {};
    this._response = () => {};
    this._next = () => {
      throw new Error("NO_NEXT_PROVIDED");
    };
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
      let handled = false;
      const _next = next || noop;
      const proxy = this._next(Array.from(this.proxies.values()), clientReq);

      if (proxy === null) {
        clientRes.writeHead(502);
        clientRes.end();
        return _next(new Error("NO_PROXY_AVAILABLE"));
      }

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
        targetReq.destroy(new Error("TIMEOUT"));
      });

      targetReq.once("response", targetRes => {
        clientRes.writeHead(
          targetRes.statusCode,
          targetRes.statusMessage,
          targetRes.headers
        );

        pipeline(targetRes, clientRes, () => {
          if (handled) return;

          this._response(proxy, targetRes, clientReq);
          return _next();
        });
      });

      targetReq.once("error", err => {
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

      pipeline(clientReq, targetReq, () => {});
    };
  }

  connect(options = {}) {
    const { timeout = 30000 } = options;
    return (clientReq, clientSocket, head) => {
      const proxy = this._next(Array.from(this.proxies.values()), clientReq);

      if (proxy === null) {
        return clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
      }

      const targetReq = http.request({
        hostname: proxy.url.hostname,
        port: proxy.url.port,
        headers: clientReq.headers,
        method: "CONNECT",
        path: clientReq.url,
        timeout,
        agent: this.agent
      });

      targetReq.once("error", err => {
        this._error(proxy, err, clientReq);
        return clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
      });

      targetReq.once("connect", (targetRes, targetSocket) => {
        if (targetRes.statusCode >= 200 && targetRes.statusCode < 300) {
          clientSocket.write(`HTTP/1.1 200 Connection Established\r\n\r\n`);
          targetSocket.write(head);

          targetSocket.setTimeout(timeout, () => {
            targetSocket.destroy(new Error("TIMEOUT"));
          });

          pipeline(clientSocket, targetSocket, clientSocket, err => {
            if (err) {
              this._error(proxy, err, clientReq);
            }
          });
        } else {
          targetSocket.end();
          clientSocket.end(
            `HTTP/1.1 ${targetRes.statusCode} ${targetRes.statusMessage}\r\n\r\n`
          );
        }
      });

      targetReq.setTimeout(timeout, () => {
        targetReq.destroy(new Error("TIMEOUT"));
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
