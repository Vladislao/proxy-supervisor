const url = require("url");

const Balancer = require("./core/balancer").default;
const MapExtended = require("./tools/mapextended").default;

const INITIAL_STATE = {
  blockCount: 0,
  unblockDateTime: 0,
  usedDateTime: 0
};

const create = ({ codes = [101, 200, 201, 202, 301, 302, 307, 404] } = {}) => {
  const hostnames = new MapExtended().default(() =>
    new MapExtended().default(() => ({ ...INITIAL_STATE }))
  );

  const balancer = new Balancer()
    .onNext((proxies, targetUrl) => {
      if (proxies.length === 0) return null;

      const { hostname } = url.parse(targetUrl);

      const states = hostnames.receive(hostname);
      const list = proxies.map(v => [states.get(v) || INITIAL_STATE, v]);

      const now = Date.now();

      const unblocked = list.filter(v => v[0].unblockDateTime < now);
      const usable = unblocked.length > 0 ? unblocked : list;

      const proxy = usable.sort(
        (v1, v2) => v1[0].usedDateTime - v2[0].usedDateTime
      )[0][1];

      hostnames.update(hostname, v =>
        v.update(proxy, p => ({
          ...p,
          usedDateTime: now
        }))
      );

      return proxy;
    })
    .onResponse((proxy, targetUrl, response) => {
      const { hostname } = url.parse(targetUrl);
      if (codes.some(c => c === response.statusCode)) {
        hostnames.update(hostname, v =>
          v.update(proxy, p => ({ ...p, blockCount: 0, unblockDateTime: 0 }))
        );
      } else {
        hostnames.update(hostname, v =>
          v.update(proxy, p => {
            if (p.blockCount < 10) {
              p.blockCount += 1;
            }

            p.unblockDateTime =
              Date.now() + Math.pow(p.blockCount + 2, 3) * 1000;
            return p;
          })
        );
      }
    })
    .onError((proxy, targetUrl) => {
      const { hostname } = url.parse(targetUrl);
      hostnames.update(hostname, v =>
        v.update(proxy, p => {
          if (p.blockCount < 10) {
            p.blockCount += 1;
          }

          p.unblockDateTime = Date.now() + Math.pow(p.blockCount + 2, 3) * 1000;
          return p;
        })
      );
    });

  balancer.__resolver = hostnames;

  return balancer;
};

module.exports.default = create;
