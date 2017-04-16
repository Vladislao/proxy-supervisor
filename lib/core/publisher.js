module.exports = class Publisher {
  constructor() {
    this.listeners = [];
  }

  addListener(ctx) {
    this.listeners.push(ctx);
  }
};
