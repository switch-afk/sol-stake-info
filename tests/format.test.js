'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatHuman, formatJson, formatSol, formatUtc, formatLockup } = require('../src/format');
const fx = require('./helpers/stake-fixtures');

const DELEGATED = {
  address: fx.STAKE_ACCOUNT,
  state: 'delegated',
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
  host: 'rpc.example.com',
};

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
    formatLockup({ custodian: fx.CUSTODIAN, epoch: 900, unixTimestamp: 1796083200 }),
    `until epoch 900 and 2026-12-01 00:00 UTC (custodian ${fx.CUSTODIAN})`
  );
  assert.equal(
    formatLockup({ custodian: fx.CUSTODIAN, epoch: 900, unixTimestamp: 0 }),
    `until epoch 900 (custodian ${fx.CUSTODIAN})`
  );
  assert.equal(
    formatLockup({ custodian: fx.CUSTODIAN, epoch: 0, unixTimestamp: 1796083200 }),
    `until 2026-12-01 00:00 UTC (custodian ${fx.CUSTODIAN})`
  );
});

test('formatHuman for a delegated account', () => {
  assert.equal(
    formatHuman(DELEGATED),
    [
      `Stake account  ${fx.STAKE_ACCOUNT}`,
      'State          delegated',
      'Balance        1.00228288 SOL',
      'Delegated      1 SOL',
      `Validator      ${fx.VOTER}`,
      'Activated      epoch 800',
      'Rent reserve   0.00228288 SOL',
      `Staker         ${fx.STAKER}`,
      `Withdrawer     ${fx.WITHDRAWER}`,
      'Lockup         none',
      'RPC            rpc.example.com',
      '',
    ].join('\n')
  );
});

test('formatHuman shows the deactivation epoch when there is one', () => {
  const info = { ...DELEGATED, delegation: { ...DELEGATED.delegation, deactivationEpoch: 812 } };
  assert.match(formatHuman(info), /^Deactivated {4}epoch 812$/m);
});

test('formatHuman for an initialized account has no delegation rows', () => {
  const info = { ...DELEGATED, state: 'initialized', lamports: 2282880, delegation: null };
  const text = formatHuman(info);
  assert.match(text, /^State {10}initialized$/m);
  assert.ok(!text.includes('Validator'));
  assert.ok(!text.includes('Delegated'));
});

test('formatHuman for an uninitialized account has no authorities', () => {
  const info = {
    ...DELEGATED,
    state: 'uninitialized',
    rentExemptReserve: null,
    staker: null,
    withdrawer: null,
    delegation: null,
  };
  const text = formatHuman(info);
  assert.ok(!text.includes('Staker'));
  assert.ok(!text.includes('Lockup'));
  assert.ok(!text.includes('Rent reserve'));
  assert.match(text, /^RPC {12}rpc\.example\.com$/m);
});

test('formatJson prints the same data with the host as rpc', () => {
  const parsed = JSON.parse(formatJson(DELEGATED));
  assert.equal(parsed.address, fx.STAKE_ACCOUNT);
  assert.equal(parsed.state, 'delegated');
  assert.equal(parsed.lamports, 1002282880);
  assert.equal(parsed.delegation.voter, fx.VOTER);
  assert.equal(parsed.delegation.deactivationEpoch, null);
  assert.equal(parsed.lockup, null);
  assert.equal(parsed.rpc, 'rpc.example.com');
  assert.ok(!('host' in parsed));
});