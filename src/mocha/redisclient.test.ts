import { describe, it } from 'mocha';
import assert from 'assert';
import { RedisClient } from '../redisclient';

class FakeRedis {
  handlers: Record<string, Function[]> = {};
  getCalledWith: any[] = [];
  setCalledWith: any[] = [];
  scriptCalledWith: any[] = [];

  // configurable returns
  _getReturn: any = null;
  _setReturn: any = 'OK';
  _scriptReturn: any = 'sha1';
  _scriptReject: any = null;

  on(event: string, handler: Function) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  async emit(event: string) {
    const hs = this.handlers[event] || [];
    await Promise.all(hs.map((h) => h()));
  }

  get(key: string) {
    this.getCalledWith.push(key);
    return Promise.resolve(this._getReturn);
  }

  set(...args: any[]) {
    this.setCalledWith.push(args);
    return Promise.resolve(this._setReturn);
  }

  script(...args: any[]) {
    this.scriptCalledWith.push(args);
    if (this._scriptReject) return Promise.reject(this._scriptReject);
    return Promise.resolve(this._scriptReturn);
  }
}

describe('RedisClient', () => {
  it('forwards get to client.get', async () => {
    const fake = new FakeRedis();
    fake._getReturn = 'value1';
    const redis = new RedisClient((fake as unknown) as any);

    const res = await redis.get('mykey');
    assert.equal(res, 'value1');
    assert.equal(fake.getCalledWith.length, 1);
    assert.equal(fake.getCalledWith[0], 'mykey');
  });

  it('forwards set without expiry to client.set', async () => {
    const fake = new FakeRedis();
    fake._setReturn = 'OK';
    const redis = new RedisClient((fake as unknown) as any);

    const res = await redis.set('k', 'v');
    assert.equal(res, 'OK');
    assert.equal(fake.setCalledWith.length, 1);
    assert.deepEqual(fake.setCalledWith[0], ['k', 'v']);
  });

  it('forwards set with expiry to client.set with EX and seconds', async () => {
    const fake = new FakeRedis();
    fake._setReturn = 'OK';
    const redis = new RedisClient((fake as unknown) as any);

    const res = await redis.set('k2', 'v2', 60);
    assert.equal(res, 'OK');
    assert.equal(fake.setCalledWith.length, 1);
    assert.deepEqual(fake.setCalledWith[0], ['k2', 'v2', 'EX', 60]);
  });

  it("loads script on 'connect' and logs success", async () => {
    const fake = new FakeRedis();
    fake._scriptReturn = 'sha';
    const redis = new RedisClient((fake as unknown) as any);

    let logged = '';
    const origLog = console.log;
    console.log = (msg?: any) => {
      logged = String(msg);
    };

    try {
      await fake.emit('connect');
      // wait one tick to let async handlers settle
      await new Promise((r) => setImmediate(r));

      assert.equal(fake.scriptCalledWith.length, 1);
      const [cmd, script] = fake.scriptCalledWith[0];
      assert.equal(cmd, 'LOAD');
      assert.ok(typeof script === 'string');
      assert.ok(script.includes("PING") || script.includes("redis.call('PING')"));
      assert.ok(logged.includes('Lua script loaded successfully.'));
    } finally {
      console.log = origLog;
    }
  });

  it("logs error when script load fails", async () => {
    const fake = new FakeRedis();
    fake._scriptReject = new Error('boom');
    const redis = new RedisClient((fake as unknown) as any);

    let errLogged = '';
    const origError = console.error;
    console.error = (msg?: any) => {
      errLogged = String(msg);
    };

    try {
      await fake.emit('connect');
      await new Promise((r) => setImmediate(r));

      assert.equal(fake.scriptCalledWith.length, 1);
      assert.ok(errLogged.includes('Error loading Lua script:'));
    } finally {
      console.error = origError;
    }
  });
});
