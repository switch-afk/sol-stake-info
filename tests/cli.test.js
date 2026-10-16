'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/cli');
const { createMockRpc, httpError, rpcError } = require('./helpers/mock-rpc');
const fx = require('./helpers/stake-fixtures');
const { version } = require('../package.json');

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

test('--help prints usage and exits 0', async () => {
  const stdout = sink();
  const code = await run(['--help'], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.match(stdout.data, /Usage:/);
  assert.match(stdout.data, /--rpc/);
  assert.match(stdout.data, /SOL_STAKE_INFO_RPC/);
  assert.match(stdout.data, /--json/);
});

test('--version prints the package version', async () => {
  const stdout = sink();
  const code = await run(['--version'], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.equal(stdout.data.trim(), version);
});

test('usage errors exit 2, print to stderr and make no RPC call', async () => {
  const { io, mock, stdout, stderr } = ioFor(fx.lookupHandlers());
  const code = await run([], io);
  assert.equal(code, 2);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /Error: Missing stake account address/);
  assert.match(stderr.data, /Usage:/);
  assert.equal(mock.calls.length, 0);
});

test('an invalid address exits 2 without calling the RPC', async () => {
  const { io, mock, stderr } = ioFor(fx.lookupHandlers());
  const code = await run(['nope'], io);
  assert.equal(code, 2);
  assert.match(stderr.data, /is not a valid Solana address/);
  assert.equal(mock.calls.length, 0);
});

test('looks up an active stake account and prints it', async () => {
  const { io, mock, stdout, stderr } = ioFor(fx.lookupHandlers());
  const code = await run([fx.STAKE_ACCOUNT, '--rpc', 'https://rpc.example.com/?api-key=secret'], io);
  assert.equal(code, 0);
  assert.equal(stderr.data, '');
  assert.match(stdout.data, new RegExp(`Stake account {2}${fx.STAKE_ACCOUNT}`));
  assert.match(stdout.data, /^Status {9}active$/m);
  assert.match(stdout.data, /^Current epoch {2}900$/m);
  assert.match(stdout.data, /^Delegated {6}1 SOL$/m);
  assert.match(stdout.data, /^Active {9}1 SOL$/m);
  assert.match(stdout.data, new RegExp(`^Validator {6}${fx.VOTER}$`, 'm'));
  assert.match(stdout.data, /^RPC {12}rpc\.example\.com$/m);
  assert.ok(!stdout.data.includes('secret'));
  assert.equal(mock.calls[0].params[0], fx.STAKE_ACCOUNT);
});

test('a stake that is still warming up shows as activating', async () => {
  const handlers = fx.lookupHandlers({
    epoch: 801,
    account: fx.delegatedAccount({ delegation: { stake: '1000' } }),
    history: [{ epoch: 800, effective: 1000, activating: 4000, deactivating: 0 }],
  });
  const { io, stdout } = ioFor(handlers);
  const code = await run([fx.STAKE_ACCOUNT, '--json'], io);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout.data);
  assert.equal(parsed.status, 'activating');
  assert.deepEqual(parsed.activation, { effective: 22, activating: 978, deactivating: 0 });
});

test('a deactivating stake shows as deactivating', async () => {
  const handlers = fx.lookupHandlers({
    epoch: 812,
    account: fx.delegatedAccount({ delegation: { deactivationEpoch: '812' } }),
  });
  const { io, stdout } = ioFor(handlers);
  assert.equal(await run([fx.STAKE_ACCOUNT, '--json'], io), 0);
  const parsed = JSON.parse(stdout.data);
  assert.equal(parsed.status, 'deactivating');
  assert.equal(parsed.activation.deactivating, 1000000000);
});

test('an undelegated account skips the stake history call', async () => {
  const { io, mock, stdout } = ioFor(fx.lookupHandlers({ account: fx.initializedAccount() }));
  assert.equal(await run([fx.STAKE_ACCOUNT, '--json'], io), 0);
  assert.equal(JSON.parse(stdout.data).status, 'undelegated');
  assert.ok(mock.calls.every((call) => call.params[0] !== fx.STAKE_HISTORY_SYSVAR));
});

test('a lockup is reported as in force or expired using the current epoch and time', async () => {
  const lockup = { custodian: fx.CUSTODIAN, epoch: 950, unixTimestamp: 1796083200 };
  const locked = ioFor(fx.lookupHandlers({ account: fx.delegatedAccount({ lockup }) }));
  assert.equal(await run([fx.STAKE_ACCOUNT, '--json'], locked.io), 0);
  assert.equal(JSON.parse(locked.stdout.data).lockup.inForce, true);

  const expired = ioFor(fx.lookupHandlers({ account: fx.delegatedAccount({ lockup }), epoch: 960 }), {
    now: () => 1796083201,
  });
  assert.equal(await run([fx.STAKE_ACCOUNT, '--json'], expired.io), 0);
  assert.equal(JSON.parse(expired.stdout.data).lockup.inForce, false);
});

test('--json prints the account as JSON', async () => {
  const { io, stdout } = ioFor(fx.lookupHandlers());
  const code = await run([fx.STAKE_ACCOUNT, '--json', '--rpc', 'https://rpc.example.com'], io);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout.data);
  assert.equal(parsed.address, fx.STAKE_ACCOUNT);
  assert.equal(parsed.type, 'delegated');
  assert.equal(parsed.status, 'active');
  assert.equal(parsed.epoch, 900);
  assert.equal(parsed.delegation.stake, 1000000000);
  assert.equal(parsed.rpc, 'rpc.example.com');
});

test('SOL_STAKE_INFO_RPC is used when --rpc is not given, and --rpc wins when it is', async () => {
  const env = { SOL_STAKE_INFO_RPC: 'https://env.example.com' };

  const fromEnv = ioFor(fx.lookupHandlers(), { env });
  assert.equal(await run([fx.STAKE_ACCOUNT], fromEnv.io), 0);
  assert.equal(fromEnv.mock.calls[0].url, 'https://env.example.com');

  const fromFlag = ioFor(fx.lookupHandlers(), { env });
  assert.equal(await run([fx.STAKE_ACCOUNT, '--rpc', 'https://flag.example.com'], fromFlag.io), 0);
  assert.equal(fromFlag.mock.calls[0].url, 'https://flag.example.com');
});

test('an account that does not exist exits 1 with the error on stderr', async () => {
  const handlers = fx.lookupHandlers({ account: { context: { slot: 1 }, value: null } });
  const { io, stdout, stderr } = ioFor(handlers);
  const code = await run([fx.STAKE_ACCOUNT], io);
  assert.equal(code, 1);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /Error: No account found at/);
});

test('an account owned by another program exits 1', async () => {
  const other = fx.wrap({ type: 'account' }, { owner: fx.STAKER });
  const { io, stdout, stderr } = ioFor(fx.lookupHandlers({ account: other }));
  const code = await run([fx.STAKE_ACCOUNT], io);
  assert.equal(code, 1);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /is not a stake account/);
});

test('RPC failures exit 1 and show the hostname only', async () => {
  const http = ioFor({ getAccountInfo: httpError(500) });
  assert.equal(await run([fx.STAKE_ACCOUNT, '--rpc', 'https://rpc.example.com/?api-key=secret'], http.io), 1);
  assert.match(http.stderr.data, /Error: rpc\.example\.com returned HTTP 500/);
  assert.ok(!http.stderr.data.includes('secret'));

  const rpc = ioFor({ getAccountInfo: rpcError(-32602, 'Invalid param') });
  assert.equal(await run([fx.STAKE_ACCOUNT], rpc.io), 1);
  assert.match(rpc.stderr.data, /Error: RPC error from .*Invalid param/);
});

test('a failing epoch lookup exits 1', async () => {
  const handlers = { ...fx.lookupHandlers(), getEpochInfo: httpError(503) };
  const { io, stdout, stderr } = ioFor(handlers);
  assert.equal(await run([fx.STAKE_ACCOUNT], io), 1);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /HTTP 503/);
});