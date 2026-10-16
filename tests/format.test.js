'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatHuman, formatJson, formatSol, formatUtc, formatLockup } = require('../src/format');
const fx = require('./helpers/stake-fixtures');

const DELEGATED = {
  address: fx.STAKE_ACCOUNT,
  type: 'delegated',
  status: 'active',
  epoch: 900,
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
  activation: { effective: 1000000000, activating: 0, deactivating: 0 },
  host: 'rpc.example.com',
};

const LOCKUP = { custodian: fx.CUSTODIAN, epoch: 900, unixTimestamp: 1796083200 };

test('formatSol shows exact lamports as SOL without trailing zeros', () => {
  assert.equal(formatSol(0), '0 SOL');
  assert.equal(formatSol(1), '0.000000001 SOL');
  assert.equal(formatSol(1000000000), '1 SOL');
  assert.equal(formatSol(1002282880), '1.00228288 SOL');
  assert.equal(formatSol(2282880), '0.00228288 SOL');
  assert.equal(formatSol(1234567890123456), '1,234,567.890123456 SOL');
  assert.equal(formatSol(7999999999999999), '7,999,999.999999999 SOL');
});

test('formatUtc prints minutes in UTC', () => {
  assert.equal(formatUtc(1796083200), '2026-12-01 00:00 UTC');
});

test('formatLockup', () => {
  assert.equal(formatLockup(null), 'none');
  assert.equal(
    formatLockup({ ...LOCKUP, inForce: true }),
    `in force until epoch 900 and 2026-12-01 00:00 UTC (custodian ${fx.CUSTODIAN})`
  );
  assert.equal(
    formatLockup({ ...LOCKUP, inForce: false }),
    'expired (was until epoch 900 and 2026-12-01 00:00 UTC)'
  );
  assert.equal(
    formatLockup({ custodian: fx.CUSTODIAN, epoch: 900, unixTimestamp: 0, inForce: true }),
    `in force until epoch 900 (custodian ${fx.CUSTODIAN})`
  );
  assert.equal(
    formatLockup({ custodian: fx.CUSTODIAN, epoch: 0, unixTimestamp: 1796083200, inForce: false }),
    'expired (was until 2026-12-01 00:00 UTC)'
  );
});

test('formatHuman for an active delegated account', () => {
  assert.equal(
    formatHuman(DELEGATED),
    [
      `Stake account  ${fx.STAKE_ACCOUNT}`,
      'Status         active',
      'Current epoch  900',
      'Balance        1.00228288 SOL',
      'Delegated      1 SOL',
      'Active         1 SOL',
      `Validator      ${fx.VOTER}`,
      'Activation     epoch 800',
      'Rent reserve   0.00228288 SOL',
      `Staker         ${fx.STAKER}`,
      `Withdrawer     ${fx.WITHDRAWER}`,
      'Lockup         none',
      'RPC            rpc.example.com',
      '',
    ].join('\n')
  );
});

test('formatHuman shows only the non-zero activation amounts', () => {
  const info = {
    ...DELEGATED,
    status: 'activating',
    activation: { effective: 22, activating: 978, deactivating: 0 },
  };
  const text = formatHuman(info);
  assert.match(text, /^Status {9}activating$/m);
  assert.match(text, /^Active {9}0\.000000022 SOL$/m);
  assert.match(text, /^Activating {5}0\.000000978 SOL$/m);
  assert.ok(!text.includes('Deactivating'));
});

test('formatHuman shows the deactivation epoch and amount', () => {
  const info = {
    ...DELEGATED,
    status: 'deactivating',
    delegation: { ...DELEGATED.delegation, deactivationEpoch: 900 },
    activation: { effective: 1000000000, activating: 0, deactivating: 1000000000 },
  };
  const text = formatHuman(info);
  assert.match(text, /^Deactivating {3}1 SOL$/m);
  assert.match(text, /^Deactivation {3}epoch 900$/m);
});

test('formatHuman for an undelegated account has no delegation rows', () => {
  const info = {
    ...DELEGATED,
    type: 'initialized',
    status: 'undelegated',
    lamports: 2282880,
    delegation: null,
    activation: null,
  };
  const text = formatHuman(info);
  assert.match(text, /^Status {9}undelegated$/m);
  assert.ok(!text.includes('Validator'));
  assert.ok(!text.includes('Delegated'));
});

test('formatHuman for an uninitialized account has no authorities', () => {
  const info = {
    ...DELEGATED,
    type: 'uninitialized',
    status: 'uninitialized',
    rentExemptReserve: null,
    staker: null,
    withdrawer: null,
    delegation: null,
    activation: null,
  };
  const text = formatHuman(info);
  assert.ok(!text.includes('Staker'));
  assert.ok(!text.includes('Lockup'));
  assert.ok(!text.includes('Rent reserve'));
  assert.match(text, /^RPC {12}rpc\.example\.com$/m);
});

test('formatHuman shows a lockup that is in force', () => {
  const info = { ...DELEGATED, lockup: { ...LOCKUP, inForce: true } };
  assert.match(formatHuman(info), /^Lockup {9}in force until epoch 900 and 2026-12-01 00:00 UTC/m);
});

test('formatJson prints the same data with the host as rpc', () => {
  const parsed = JSON.parse(formatJson(DELEGATED));
  assert.equal(parsed.address, fx.STAKE_ACCOUNT);
  assert.equal(parsed.type, 'delegated');
  assert.equal(parsed.status, 'active');
  assert.equal(parsed.epoch, 900);
  assert.equal(parsed.lamports, 1002282880);
  assert.equal(parsed.delegation.voter, fx.VOTER);
  assert.equal(parsed.delegation.deactivationEpoch, null);
  assert.deepEqual(parsed.activation, { effective: 1000000000, activating: 0, deactivating: 0 });
  assert.equal(parsed.lockup, null);
  assert.equal(parsed.rpc, 'rpc.example.com');
  assert.ok(!('host' in parsed));
  assert.ok(!('state' in parsed));
});