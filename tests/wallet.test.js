'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchWalletStakeAccounts, buildWalletReport } = require('../src/wallet');
const { LookupError, STAKE_PROGRAM } = require('../src/account');
const { RpcError, createRpcClient } = require('../src/rpc');
const { createMockRpc, httpError, rpcError } = require('./helpers/mock-rpc');
const fx = require('./helpers/stake-fixtures');
const w = require('./helpers/wallet-fixtures');

function clientFor(handlers) {
  const mock = createMockRpc(handlers);
  return { client: createRpcClient({ url: 'https://rpc.example.com/?api-key=secret', fetch: mock.fetch }), mock };
}

test('asks for the accounts where the wallet is staker and where it is withdrawer', async () => {
  const { client, mock } = clientFor(w.walletHandlers());
  assert.deepEqual(await fetchWalletStakeAccounts(client, w.WALLET), []);

  const offsets = mock.calls.map((call) => call.params[1].filters[1].memcmp.offset).sort((a, b) => a - b);
  assert.deepEqual(offsets, [12, 44]);
  for (const call of mock.calls) {
    assert.equal(call.method, 'getProgramAccounts');
    assert.equal(call.params[0], STAKE_PROGRAM);
    assert.equal(call.params[1].encoding, 'jsonParsed');
    assert.deepEqual(call.params[1].filters[0], { dataSize: 200 });
    assert.equal(call.params[1].filters[1].memcmp.bytes, w.WALLET);
  }
});

test('merges both queries, lists each account once and works out the role', async () => {
  const staking = fx.delegatedAccount(); // staker is the wallet, withdrawer someone else
  const both = w.withAuthorized(fx.delegatedAccount(), w.WALLET, w.WALLET);
  const withdrawing = w.withAuthorized(fx.delegatedAccount(), fx.WITHDRAWER, w.WALLET);

  const { client } = clientFor(
    w.walletHandlers({
      asStaker: [w.entry(fx.STAKE_ACCOUNT, staking), w.entry(w.STAKE_ACCOUNT_2, both)],
      asWithdrawer: [w.entry(w.STAKE_ACCOUNT_2, both), w.entry(w.STAKE_ACCOUNT_3, withdrawing)],
    })
  );
  const accounts = await fetchWalletStakeAccounts(client, w.WALLET);

  assert.deepEqual(
    accounts.map((a) => [a.address, a.role]),
    [
      [fx.STAKE_ACCOUNT, 'staker'],
      [w.STAKE_ACCOUNT_2, 'both'],
      [w.STAKE_ACCOUNT_3, 'withdrawer'],
    ]
  );
  assert.equal(accounts[0].delegation.voter, fx.VOTER);
});

test('a server that blocks getProgramAccounts gets a hint to use your own RPC', async () => {
  for (const blocked of [httpError(403), rpcError(-32010, 'excluded from account secondary indexes')]) {
    const { client } = clientFor({ getProgramAccounts: blocked });
    await assert.rejects(fetchWalletStakeAccounts(client, w.WALLET), (err) => {
      assert.ok(err instanceof LookupError);
      assert.match(err.message, /getProgramAccounts is often blocked or rate limited/);
      assert.match(err.message, /--rpc/);
      assert.match(err.message, /rpc\.example\.com/);
      assert.ok(!err.message.includes('secret'));
      return true;
    });
  }
});

test('a network failure is not blamed on getProgramAccounts', async () => {
  const client = createRpcClient({
    url: 'https://rpc.example.com',
    fetch: async () => {
      throw new Error('offline');
    },
  });
  await assert.rejects(fetchWalletStakeAccounts(client, w.WALLET), (err) => {
    assert.ok(err instanceof RpcError);
    assert.ok(!(err instanceof LookupError));
    assert.equal(err.message, 'Could not reach rpc.example.com');
    return true;
  });
});

test('an unexpected response shape is reported cleanly', async () => {
  const notAnArray = clientFor({ getProgramAccounts: { oops: true } });
  await assert.rejects(fetchWalletStakeAccounts(notAnArray.client, w.WALLET), /Could not read the stake accounts/);

  const noPubkey = clientFor(w.walletHandlers({ asStaker: [{ account: fx.delegatedAccount().value }] }));
  await assert.rejects(fetchWalletStakeAccounts(noPubkey.client, w.WALLET), /Could not read the stake accounts/);
});

async function reportFor(asStaker, options = {}) {
  const { client } = clientFor(w.walletHandlers({ asStaker, ...options }));
  const accounts = await fetchWalletStakeAccounts(client, w.WALLET);
  return buildWalletReport(w.WALLET, accounts, { epoch: 900, history: new Map(), now: 1750000000 });
}

test('buildWalletReport puts the biggest account first and adds up the totals', async () => {
  const report = await reportFor([
    w.entry(w.STAKE_ACCOUNT_3, fx.initializedAccount()),
    w.entry(
      w.STAKE_ACCOUNT_2,
      fx.delegatedAccount({ delegation: { activationEpoch: '900' }, lamports: 1002282880 })
    ),
    w.entry(
      fx.STAKE_ACCOUNT,
      fx.delegatedAccount({ delegation: { stake: '3000000000' }, lamports: 3002282880 })
    ),
  ]);

  assert.equal(report.wallet, w.WALLET);
  assert.equal(report.epoch, 900);
  assert.deepEqual(
    report.accounts.map((a) => [a.address, a.status]),
    [
      [fx.STAKE_ACCOUNT, 'active'],
      [w.STAKE_ACCOUNT_2, 'activating'],
      [w.STAKE_ACCOUNT_3, 'undelegated'],
    ]
  );
  assert.deepEqual(report.totals, {
    lamports: 4006848640,
    active: 3000000000,
    activating: 1000000000,
    deactivating: 0,
  });
});

test('buildWalletReport breaks ties by address', async () => {
  const report = await reportFor([
    w.entry(w.STAKE_ACCOUNT_2, fx.initializedAccount()),
    w.entry(w.STAKE_ACCOUNT_3, fx.initializedAccount()),
  ]);
  assert.deepEqual(
    report.accounts.map((a) => a.address),
    [w.STAKE_ACCOUNT_3, w.STAKE_ACCOUNT_2]
  );
});

test('buildWalletReport for a wallet with no stake accounts', async () => {
  const report = await reportFor([]);
  assert.deepEqual(report.accounts, []);
  assert.deepEqual(report.totals, { lamports: 0, active: 0, activating: 0, deactivating: 0 });
});

test('buildWalletReport refuses totals it cannot show exactly', async () => {
  const huge = fx.initializedAccount({ lamports: Number.MAX_SAFE_INTEGER });
  await assert.rejects(
    reportFor([w.entry(w.STAKE_ACCOUNT_2, huge), w.entry(w.STAKE_ACCOUNT_3, huge)]),
    /total is too large/
  );
});