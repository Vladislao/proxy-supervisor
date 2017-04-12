const expect = require('chai').expect;
const ProxyNode = require('../../lib/node');

describe('Proxy Node', () => {
  it('should create new proxy with http://admin:123@127.0.0.1:3333/', () => {
    expect(new ProxyNode('http://admin:123@127.0.0.1:3333/').url.protocol).to.be.not.null;
  });
  it('should create new proxy with http://127.0.0.1:3333/', () => {
    expect(new ProxyNode('http://127.0.0.1:3333/').url.protocol).to.be.not.null;
  });
  it('should create new proxy with http://127.0.0.1:3333', () => {
    expect(new ProxyNode('http://127.0.0.1:3333').url.protocol).to.be.not.null;
  });
  it('should create new proxy with http://127.0.0.1', () => {
    expect(new ProxyNode('http://127.0.0.1').url.protocol).to.be.not.null;
  });
  it('should create new proxy with 127.0.0.1', () => {
    expect(new ProxyNode('127.0.0.1').url.protocol).to.be.not.null;
  });

  it('should update node address', () => {
    const node = new ProxyNode('http://127.0.0.1:3333');
    expect(node.url.port).to.be.eql('3333');

    node.update('http://127.0.0.1:3334');
    expect(node.url.port).to.be.eql('3334');
  });
});
