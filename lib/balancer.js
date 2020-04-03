const url = require("url");
const Balancer = require("./core/balancer").default;

const initial = {
  blockCount: 0,
  unblockDateTime: 0,
  usedDateTime: 0
};

class TargetResolver {
  constructor() {
    this.map = new Map();
  }

  get(target) {
    if (!this.map.has(target)) {
      this.map.set(target, new Map());
    }
    return this.map.get(target);
  }

  update(target, proxy, fn) {
    const map = this.get(target);
    map.set(proxy, fn({ ...(map.get(proxy) || initial) }));
    return this;
  }
}

const create = ({ codes = [101, 200, 201, 202, 301, 302, 307, 404] } = {}) => {
  const resolver = new TargetResolver();

  const balancer = new Balancer()
    .onNext((proxies, req) => {
      if (proxies.length === 0) return null;

      const target = url.parse(req.url).hostname;

      const map = resolver.get(target);
      const list = proxies.map(v => [map.get(v) || initial, v]);

      const now = Date.now();

      const unblocked = list.filter(v => v[0].unblockDateTime < now);
      const usable = unblocked.length > 0 ? unblocked : list;

      const proxy = usable.sort(
        (v1, v2) => v1[0].usedDateTime - v2[0].usedDateTime
      )[0][1];

      resolver.update(target, proxy, v => ({
        ...v,
        usedDateTime: now
      }));

      return proxy;
    })
    .onResponse((proxy, res, req) => {
      const target = url.parse(req.url).hostname;
      if (codes.some(c => c === res.statusCode)) {
        resolver.update(target, proxy, v => ({
          ...v,
          blockCount: 0,
          unblockDateTime: 0
        }));
      } else {
        resolver.update(target, proxy, v => {
          if (v.blockCount < 10) {
            v.blockCount += 1;
          }

          v.unblockDateTime = Date.now() + Math.pow(v.blockCount + 2, 3) * 1000;
          return v;
        });
      }
    })
    .onError((proxy, err, req) => {
      const target = url.parse(req.url).hostname;
      resolver.update(target, proxy, v => {
        if (v.blockCount < 10) {
          v.blockCount += 1;
        }

        v.unblockDateTime = Date.now() + Math.pow(v.blockCount + 2, 3) * 1000;
        return v;
      });
    });

  balancer.__resolver = resolver;

  return balancer;
};

module.exports.default = create;
