'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/cli');
const { createMockRpc, httpError } = require('./helpers/mock-rpc');
const fx = require('./helpers/stake-fixtures');
const w = require('./helpers/wallet-fixtures');

function sink() {
  return {
    data: '',
    write(chunk) {
      this.data += chunk;
    },
  };
}

function ioFor(handlers, extra = {}) {
  const mock = createMockRpc(handlers);
  const stdout = sink();
  const stderr = sink();
  const io = { stdout, stderr, fetch: mock.fetch, env: {}, sleep: async () => {}, now: () => 1750000000, ...extra };
  return { io, mock, stdout, stderr };
}

const TWO_ACCOUNTS = {
  asStaker: [
    w.entry(fx.STAKE_ACCOUNT, fx.delegatedAccount({ delegation: { stake: '3000000000' }, lamports: 3002282880 })),
  ],
  asWithdrawer: [w.entry(w.STAKE_ACCOUNT_3, w.withAuthorized(fx.initializedAccount(), fx.WITHDRAWER, w.WALLET))],
};

test('--help mentions --wallet', async () => {
  const stdout = sink();
  assert.equal(await run(['--help'], { stdout, stderr: sink() }), 0);
  assert.match(stdout.data, /--wallet <address>/);
  assert.match(stdout.data, /getProgramAccounts/);
});

test('--wallet lists the stake accounts a wallet controls', async () => {
  const { io, stdout, stderr } = ioFor(w.walletHandlers(TWO_ACCOUNTS));
  const code = await run(['--wallet', w.WALLET, '--rpc', 'https://rpc.example.com/?api-key=secret'], io);
  assert.equal(code, 0);
  assert.equal(stderr.data, '');
  assert.match(stdout.data, new RegExp(`^Wallet {10}${w.WALLET}$`, 'm'));
  assert.match(stdout.data, /^Stake accounts {2}2$/m);
  assert.match(stdout.data, /^Total balance {3}3\.00456576 SOL$/m);
  assert.match(stdout.data, new RegExp(`^${fx.STAKE_ACCOUNT} {2}active `, 'm'));
  assert.match(stdout.data, new RegExp(`^${w.STAKE_ACCOUNT_3} {2}undelegated `, 'm'));
  assert.ok(!stdout.data.includes('secret'));
});

test('--wallet --json prints the report as JSON', async () => {
  const { io, stdout } = ioFor(w.walletHandlers(TWO_ACCOUNTS));
  assert.equal(await run(['--wallet', w.WALLET, '--json'], io), 0);
  const parsed = JSON.parse(stdout.data);
  assert.equal(parsed.wallet, w.WALLET);
  assert.equal(parsed.count, 2);
  assert.equal(parsed.totals.lamports, 3004565760);
  assert.equal(parsed.totals.active, 3000000000);
  assert.deepEqual(
    parsed.accounts.map((a) => [a.address, a.status, a.role]),
    [
      [fx.STAKE_ACCOUNT, 'active', 'staker'],
      [w.STAKE_ACCOUNT_3, 'undelegated', 'withdrawer'],
    ]
  );
});

test('a wallet with no stake accounts is not an error', async () => {
  const { io, mock, stdout } = ioFor(w.walletHandlers());
  assert.equal(await run(['--wallet', w.WALLET], io), 0);
  assert.match(stdout.data, /No stake accounts found for this wallet\./);
  assert.match(stdout.data, /^Stake accounts {2}0$/m);
  assert.ok(mock.calls.every((call) => call.method !== 'getAccountInfo'));
});

test('the stake history is only fetched when something is delegated', async () => {
  const onlyUndelegated = ioFor(w.walletHandlers({ asStaker: [w.entry(w.STAKE_ACCOUNT_2, fx.initializedAccount())] }));
  assert.equal(await run(['--wallet', w.WALLET], onlyUndelegated.io), 0);
  assert.ok(onlyUndelegated.mock.calls.every((call) => call.method !== 'getAccountInfo'));

  const delegated = ioFor(w.walletHandlers(TWO_ACCOUNTS));
  assert.equal(await run(['--wallet', w.WALLET], delegated.io), 0);
  assert.equal(delegated.mock.calls.filter((call) => call.method === 'getAccountInfo').length, 1);
});

test('a stake account address and --wallet together is a usage error', async () => {
  const { io, mock, stderr } = ioFor(w.walletHandlers());
  assert.equal(await run([fx.STAKE_ACCOUNT, '--wallet', w.WALLET], io), 2);
  assert.match(stderr.data, /either a stake account address or --wallet/);
  assert.equal(mock.calls.length, 0);
});

test('an invalid --wallet address is a usage error', async () => {
  const { io, mock, stderr } = ioFor(w.walletHandlers());
  assert.equal(await run(['--wallet', 'nope'], io), 2);
  assert.match(stderr.data, /is not a valid Solana address/);
  assert.equal(mock.calls.length, 0);
});

test('an RPC that blocks getProgramAccounts exits 1 with a hint', async () => {
  const { io, stdout, stderr } = ioFor({ getProgramAccounts: httpError(403) });
  assert.equal(await run(['--wallet', w.WALLET, '--rpc', 'https://rpc.example.com/?api-key=secret'], io), 1);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /Error: rpc\.example\.com returned HTTP 403/);
  assert.match(stderr.data, /try --rpc with your own endpoint/);
  assert.ok(!stderr.data.includes('secret'));
});