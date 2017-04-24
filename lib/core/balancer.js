const request = require('request');
const url = require('url');

const fulfill = (proxy) => {
  if (proxy.slashes) return proxy;
  return url.parse('http://' + proxy.href);
};

const parse = (address) => {
  if (address instanceof url.Url) return fulfill(address);
  return fulfill(url.parse(address));
};

module.exports = class Balancer {
  constructor() {
    this.proxies = new Map();
    this._init = proxy => proxy;
  }

  add(proxies) {
    (Array.isArray(proxies) ? proxies : [proxies])
      .map(p => parse(p))
      .filter(p => p.host)
      .forEach((p) => {
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
      .map(p => parse(p))
      .filter(p => p.host)
      .forEach((p) => {
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

  proxy() {
    return (req, res, next) => {
      const proxy = this._next(Array.from(this.proxies.values()));
      if (proxy === null) next(new Error('no proxy is available!'));

      req.proxy = proxy;
      return req
        .pipe(request(req.url, { proxy: proxy.url.href }))
        .on('error', (e) => {
          this._error(proxy, e);
          if (next) next(e);
        })
        .on('response', (response) => {
          this._response(proxy, response);
          if (next) next();
        })
        .pipe(res);
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
};
