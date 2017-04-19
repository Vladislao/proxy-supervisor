const { expect, spy } = require('chai');
const Monitor = require('../../lib/monitor');

describe('Monitor', () => {
  describe('check', () => {
    it('should trigger check after creation', (done) => {
      const publisher = new Monitor({ interval: 0 });
      const check = spy.on(publisher, 'check');

      setTimeout(() => {
        expect(check).to.be.spy;
        expect(check).to.have.been.called();
        done();
      }, 30);
    });

    it('should be called periodically', (done) => {
      const publisher = new Monitor({ interval: 0 });
      const check = spy.on(publisher, 'check');

      setTimeout(() => {
        expect(check).to.be.spy;
        expect(check).to.have.been.called.gt(2);
        done();
      }, 30);
    });
  });
});
