class MapExtended extends Map {
  constructor(params) {
    super(params);
    this._default = () => 0;
  }

  default(fn) {
    this._default = fn;
    return this;
  }

  receive(key) {
    if (!this.has(key)) {
      this.set(key, this._default());
    }
    return this.get(key);
  }

  update(key, fn) {
    const value = this.receive(key);
    this.set(key, fn(value));
    return this;
  }
}

module.exports.default = MapExtended;
