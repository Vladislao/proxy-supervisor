const expect = require('chai').expect;
const Monitor = require('../../lib/monitor');

describe('Monitor', () => {
  it('should be started after creation', (done) => {
    const publisher = new Monitor({ interval: 100 });
    publisher.check = () => { done(); };
    setTimeout(() => { done('monitor check is not triggered!'); }, 200);
  });
  describe('.', () => {
  });
});
