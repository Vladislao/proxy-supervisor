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
    // Object.values is too hipster
    return Object.keys(merged).map(k => merged[k].url);
  }
};
