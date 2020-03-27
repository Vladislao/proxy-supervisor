module.exports = class Source {
  constructor() {
    this.listeners = [];
  }

  addListener(ctx) {
    this.listeners.push(ctx);
    return this;
  }

  proxies() {
    const merged = this.listeners
      .map(l => Array.from(l.proxies.entries()))
      .reduce((acc, arr) => {
        arr.forEach(([k, v]) => {
          acc[k] = v;
        });
        return acc;
      }, {});

    return Object.values(merged).map(v => v.url);
  }
};
