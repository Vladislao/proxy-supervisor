const expect = require('chai').expect;
const Source = require('../../../lib/core/source');

describe('Core Source', () => {
  describe('.addListener', () => {
    it('should add listners', () => {
      const source = new Source();
      source.addListener({});
      expect(source.listeners).to.be.not.empty;
    });
  });

  describe('.getProxies', () => {

  });
});
