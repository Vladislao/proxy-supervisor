module.exports = class Source {
  constructor() {
    this.listeners = [];
  }

  addListener(ctx) {
    this.listeners.push(ctx);
  }
};
