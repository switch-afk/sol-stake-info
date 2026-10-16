'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchStakeAccount, LookupError } = require('../src/account');
const { createRpcClient } = require('../src/rpc');
const { createMockRpc } = require('./helpers/mock-rpc');
const fx = require('./helpers/stake-fixtures');

function clientFor(result) {
  const mock = createMockRpc({ getAccountInfo: result });
  const client = createRpcClient({ url: 'https://rpc.example.com/?api-key=secret', fetch: mock.fetch });
  return { client, mock };
}

test('asks for the account with jsonParsed encoding', async () => {
  const { client, mock } = clientFor(fx.delegatedAccount());
  await fetchStakeAccount(client, fx.STAKE_ACCOUNT);
  assert.equal(mock.calls[0].method, 'getAccountInfo');
  assert.deepEqual(mock.calls[0].params, [fx.STAKE_ACCOUNT, { encoding: 'jsonParsed' }]);
});

test('reads a delegated stake account', async () => {
  const { client } = clientFor(fx.delegatedAccount());
  assert.deepEqual(await fetchStakeAccount(client, fx.STAKE_ACCOUNT), {
    address: fx.STAKE_ACCOUNT,
    type: 'delegated',
    lamports: 1002282880,
    rentExemptReserve: 2282880,
    staker: fx.STAKER,
    withdrawer: fx.WITHDRAWER,
    lockup: null,
    delegation: {
      voter: fx.VOTER,
      stake: 1000000000,
      activationEpoch: 800,
      deactivationEpoch: null,
      creditsObserved: 58685367,
    },
  });
});

test('a deactivation epoch other than "never" is kept', async () => {
  const { client } = clientFor(fx.delegatedAccount({ delegation: { deactivationEpoch: '812' } }));
  const info = await fetchStakeAccount(client, fx.STAKE_ACCOUNT);
  assert.equal(info.delegation.deactivationEpoch, 812);
});

test('reads an initialized stake account that was never delegated', async () => {
  const { client } = clientFor(fx.initializedAccount());
  const info = await fetchStakeAccount(client, fx.STAKE_ACCOUNT);
  assert.equal(info.type, 'initialized');
  assert.equal(info.delegation, null);
  assert.equal(info.staker, fx.STAKER);
  assert.equal(info.lamports, 2282880);
});

test('reads an uninitialized stake account', async () => {
  const { client } = clientFor(fx.uninitializedAccount());
  const info = await fetchStakeAccount(client, fx.STAKE_ACCOUNT);
  assert.equal(info.type, 'uninitialized');
  assert.equal(info.staker, null);
  assert.equal(info.rentExemptReserve, null);
  assert.equal(info.lockup, null);
  assert.equal(info.delegation, null);
});

test('reads a lockup, and treats epoch 0 with timestamp 0 as none', async () => {
  const lockup = { custodian: fx.CUSTODIAN, epoch: 900, unixTimestamp: 1796083200 };
  const locked = await fetchStakeAccount(clientFor(fx.delegatedAccount({ lockup })).client, fx.STAKE_ACCOUNT);
  assert.deepEqual(locked.lockup, lockup);

  const timeOnly = { custodian: fx.CUSTODIAN, epoch: 0, unixTimestamp: 1796083200 };
  const partial = await fetchStakeAccount(
    clientFor(fx.delegatedAccount({ lockup: timeOnly })).client,
    fx.STAKE_ACCOUNT
  );
  assert.deepEqual(partial.lockup, timeOnly);

  const none = await fetchStakeAccount(clientFor(fx.delegatedAccount()).client, fx.STAKE_ACCOUNT);
  assert.equal(none.lockup, null);
});

test('a missing account is a LookupError naming the host only', async () => {
  const { client } = clientFor({ context: { slot: 1 }, value: null });
  await assert.rejects(fetchStakeAccount(client, fx.STAKE_ACCOUNT), (err) => {
    assert.ok(err instanceof LookupError);
    assert.match(err.message, /No account found at/);
    assert.match(err.message, /rpc\.example\.com/);
    assert.ok(!err.message.includes('secret'));
    return true;
  });
});

test('an account owned by another program is not a stake account', async () => {
  const { client } = clientFor(fx.wrap({ type: 'account' }, { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }));
  await assert.rejects(fetchStakeAccount(client, fx.STAKE_ACCOUNT), (err) => {
    assert.ok(err instanceof LookupError);
    assert.match(err.message, /is not a stake account \(owned by TokenkegQ/);
    return true;
  });
});

test('stake data the RPC could not parse is reported cleanly', async () => {
  const raw = fx.delegatedAccount();
  raw.value.data = ['', 'base64'];
  await assert.rejects(fetchStakeAccount(clientFor(raw).client, fx.STAKE_ACCOUNT), /Could not read the stake data/);
});

test('malformed parsed data is reported cleanly', async () => {
  const broken = fx.wrap({ type: 'delegated', info: { meta: { rentExemptReserve: '2282880' } } });
  await assert.rejects(fetchStakeAccount(clientFor(broken).client, fx.STAKE_ACCOUNT), /Could not read the stake data/);
});

test('amounts that are not whole safe numbers are rejected rather than rounded', async () => {
  const tooBig = fx.delegatedAccount({ delegation: { stake: '9007199254740993' } });
  await assert.rejects(
    fetchStakeAccount(clientFor(tooBig).client, fx.STAKE_ACCOUNT),
    /Could not read the delegated stake/
  );
});