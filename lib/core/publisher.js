module.exports = class Publisher {
  constructor() {
    this.listeners = [];
  }

  addListener(ctx) {
    this.listeners.push(ctx);
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
