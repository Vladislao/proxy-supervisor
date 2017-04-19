const expect = require('chai').expect;
const Publisher = require('../../../lib/core/publisher');

describe('Core Publisher', () => {
  describe('.addListener', () => {
    it('should add listners', () => {
      const publisher = new Publisher();
      publisher.addListener({});
      expect(publisher.listeners).to.be.not.empty;
    });
  });
});
