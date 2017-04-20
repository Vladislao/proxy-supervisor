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
    return Object.values(merged).map(p => p.url);
  }
};
