// const casual = require('casual');
const promisify = require('js-promisify');
const expect = require('chai').expect;
const http = require('http');

// proxy rotator
const rotator = require('./tools/text_rotator');
// mock proxy server
const proxy = require('./tools/test_proxy');
// mock endserver
const endserver = require('./tools/test_endserver');

const request = async (options, body) => new Promise((resolve, reject) => {
  const req = http
    .request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        resolve(rawData);
      });
    })
    .on('error', (e) => { reject(e); });

  if (body) req.write(body);
  req.end();
});

before(async () => {
  await promisify(rotator.listen, [23450], rotator);
  await promisify(proxy.listen, [23451], proxy);
  await promisify(endserver.listen, [23452], endserver);
});

after(async () => {
  await promisify(rotator.close, [], rotator);
  await promisify(proxy.close, [], proxy);
  await promisify(endserver.close, [], endserver);
});

process.on('exit', async () => {
  try {
    await promisify(proxy.close, [], proxy);
    await promisify(rotator.close, [], rotator);
    await promisify(endserver.close, [], endserver);
  } catch (e) {}
});

describe('environment', () => {
  it('rotator should be available', () => {
    const conf = rotator.address();
    expect(conf).to.be.not.null;
    expect(conf.port).to.be.eql(23450);
  });
  it('proxy should be available', () => {
    const conf = proxy.address();
    expect(conf).to.be.not.null;
    expect(conf.port).to.be.eql(23451);
  });
  it('endserver should be available', () => {
    const conf = endserver.address();
    expect(conf).to.be.not.null;
    expect(conf.port).to.be.eql(23452);
  });
});

const test = () => {
  describe('GET', () => {
    it('should work without proxy', async () => {
      const response = await request({
        hostname: 'localhost',
        port: 23452,
        path: '/account/logon',
        method: 'GET',
        headers: {
          connection: 'close'
        }
      });

      expect(response).to.be.eql('accepted');
    });

    it('should work with proxy', async () => {
      const response = await request({
        hostname: 'localhost',
        port: 23451,
        path: 'http://localhost:23452/account/logon',
        method: 'GET',
        headers: {
          connection: 'close',
          cookie: 'test=%#(%u0935uwj5'
        }
      });

      expect(response).to.be.eql('accepted');
    });

    it('should work with proxy rotator', async () => {
      const response = await request({
        hostname: 'localhost',
        port: 23450,
        path: 'http://localhost:23452/account/logon',
        method: 'GET',
        headers: {
          connection: 'close',
          cookie: 'test=%#(%u0935uwj5'
        }
      });

      expect(response).to.be.eql('accepted');
    });
  });

  describe('POST', () => {
    describe('Chunked', () => {
      it('should work without proxy', async () => {
        const message = 'body';
        const response = await request({
          hostname: 'localhost',
          port: 23452,
          path: '/account/logon',
          method: 'POST',
          headers: {
            connection: 'close'
          }
        }, message);

        expect(response).to.be.eql(message);
      });

      it('should work with proxy', async () => {
        const message = 'body';
        const response = await request({
          hostname: 'localhost',
          port: 23451,
          path: 'http://localhost:23452/account/logon',
          method: 'POST',
          headers: {
            connection: 'close',
            cookie: 'test=%#(%u0935uwj5'
          }
        }, 'body');

        expect(response).to.be.eql(message);
      });

      it('should work with proxy', async () => {
        const message = 'body';
        const response = await request({
          hostname: 'localhost',
          port: 23450,
          path: 'http://localhost:23452/account/logon',
          method: 'POST',
          headers: {
            connection: 'close',
            cookie: 'test=%#(%u0935uwj5'
          }
        }, 'body');

        expect(response).to.be.eql(message);
      });
    });

    describe('Content-Length', () => {
      it('should work without proxy', async () => {
        const message = 'body';
        const response = await request({
          hostname: 'localhost',
          port: 23452,
          path: '/account/logon',
          method: 'POST',
          headers: {
            Connection: 'close',
            Cookie: 'test=%#(%u0935uwj5',
            'Content-Length': Buffer.byteLength(message)
          }
        }, message);

        expect(response).to.be.eql(message);
      });

      it('should work with proxy', async () => {
        const message = 'body';
        const response = await request({
          hostname: 'localhost',
          port: 23451,
          path: 'http://localhost:23452/account/logon',
          method: 'POST',
          headers: {
            Connection: 'close',
            Cookie: 'test=%#(%u0935uwj5',
            'Content-Length': Buffer.byteLength(message)
          }
        }, message);

        expect(response).to.be.eql(message);
      });

      it('should work with proxy', async () => {
        const message = 'body';
        const response = await request({
          hostname: 'localhost',
          port: 23450,
          path: 'http://localhost:23452/account/logon',
          method: 'POST',
          headers: {
            Connection: 'close',
            Cookie: 'test=%#(%u0935uwj5',
            'Content-Length': Buffer.byteLength(message)
          }
        }, message);

        expect(response).to.be.eql(message);
      });
    });
  });
};

describe('HTTP', () => {
  test('http');
});

describe('HTTPS', () => {
  it('not implemented', () => {
    expect(false).to.be.true;
  });
});
