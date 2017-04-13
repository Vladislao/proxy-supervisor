const fs = require('fs');
const url = require('url');
const promisify = require('js-promisify');
const request = require('request');

const ProxyNode = require('./node');
const defaultStrategy = require('./strategy');

const readFile = source =>
  promisify(fs.readFile, [source, 'utf-8'], fs)
    .then(res => res.split('\n').map(x => x.trim()).filter(x => x));

class ProxySupervisor {
  constructor({ strategy = defaultStrategy, refreshInterval = null, monitorInterval = null } = {}) {
    this.strategy = strategy;
    this.config = { refreshInterval, monitorInterval };

    this.started = false;
    this.proxies = [];
    this.sources = [];
  }

  from(source) {
    if (typeof source === 'string') this.sources.push(readFile.bind(null, source));
    else if (typeof source === 'function') this.sources.push(source);
    else if (source instanceof Promise) this.sources.push(() => source);
    else throw new TypeError('source must be string, function or promise!');
    return this;
  }

  async initialize() {
    await this.refresh();

    if (Number.isInteger(this.config.refreshInterval)) {
      const refresh = () => {
        this.refresh();
        setTimeout(refresh, this.config.refreshInterval);
      };
      setTimeout(refresh, this.config.refreshInterval);
    }

    if (Number.isInteger(this.config.monitorInterval)) {
      const monitor = () => {
        this.monitor();
        setTimeout(monitor, this.config.monitorInterval);
      };
      setTimeout(monitor, this.config.monitorInterval);
    }

    return this;
  }

  // todo monitor
  async monitor() {}

  async refresh() {
    if (this.sources.length === 0) throw new Error('specify at least one source using function `from`!');
    this.started = true;

    const results = await Promise.all(this.sources.map(x => x()));
    const proxySet = new Map(this.proxies.map(p => [p.url.host, p]));

    results.forEach(r => r.forEach((address) => {
      const host = url.parse(address).host;
      if (proxySet.has(host)) {
        proxySet.get(host).update(address);
      } else {
        const proxy = this.strategy.onInit(new ProxyNode(address));
        this.proxies.push(proxy);
        proxySet.set(host, proxy);
      }
    }));

    return this;
  }

  // todo statusline
  status() {}

  proxy() {
    return async (req, res, next) => {
      if (this.started === false) await this.initialize();

      const proxy = await this.strategy.next(this.proxies);
      if (proxy === null) next(new Error('no proxy is available!'));

      req.proxy = proxy;
      return req
        .pipe(request(req.url, { proxy: proxy.url.href }))
        .on('error', (e) => {
          this.strategy.onError(proxy, e);
          if (next) next(e);
        })
        .on('response', (response) => {
          this.strategy.onResponse(proxy, response);
          if (next) next();
        })
        .pipe(res);
    };
  }
}

module.exports = ProxySupervisor;
