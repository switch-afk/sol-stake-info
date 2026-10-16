'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatWalletHuman, formatWalletJson, shortAddress } = require('../src/format');
const fx = require('./helpers/stake-fixtures');
const w = require('./helpers/wallet-fixtures');

function account(address, overrides = {}) {
  return {
    address,
    type: 'delegated',
    status: 'active',
    role: 'staker',
    lamports: 3002282880,
    rentExemptReserve: 2282880,
    staker: w.WALLET,
    withdrawer: fx.WITHDRAWER,
    lockup: null,
    delegation: { voter: fx.VOTER, stake: 3000000000, activationEpoch: 800, deactivationEpoch: null, creditsObserved: 1 },
    activation: { effective: 3000000000, activating: 0, deactivating: 0 },
    ...overrides,
  };
}

const REPORT = {
  wallet: w.WALLET,
  epoch: 900,
  host: 'rpc.example.com',
  totals: { lamports: 4006848640, active: 3000000000, activating: 1000000000, deactivating: 0 },
  accounts: [
    account(fx.STAKE_ACCOUNT),
    account(w.STAKE_ACCOUNT_2, {
      status: 'activating',
      role: 'both',
      lamports: 1002282880,
      delegation: { voter: fx.VOTER, stake: 1000000000, activationEpoch: 900, deactivationEpoch: null, creditsObserved: 1 },
      activation: { effective: 0, activating: 1000000000, deactivating: 0 },
    }),
    account(w.STAKE_ACCOUNT_3, {
      type: 'initialized',
      status: 'undelegated',
      role: 'withdrawer',
      lamports: 2282880,
      delegation: null,
      activation: null,
    }),
  ],
};

test('shortAddress keeps the first and last four characters', () => {
  assert.equal(shortAddress(fx.VOTER), 'ATok...8knL');
});

test('formatWalletHuman prints a summary and a table, biggest account first', () => {
  assert.equal(
    formatWalletHuman(REPORT),
    [
      `Wallet          ${w.WALLET}`,
      'Current epoch   900',
      'Stake accounts  3',
      'Total balance   4.00684864 SOL',
      'Active          3 SOL',
      'Activating      1 SOL',
      'RPC             rpc.example.com',
      '',
      'Account                                      Status              Balance  Validator    Role',
      `${fx.STAKE_ACCOUNT}  active       3.00228288 SOL  ATok...8knL  staker`,
      `${w.STAKE_ACCOUNT_2}  activating   1.00228288 SOL  ATok...8knL  both`,
      `${w.STAKE_ACCOUNT_3}  undelegated  0.00228288 SOL  -            withdrawer`,
      '',
    ].join('\n')
  );
});

test('formatWalletHuman for a wallet with no stake accounts', () => {
  const empty = { ...REPORT, accounts: [], totals: { lamports: 0, active: 0, activating: 0, deactivating: 0 } };
  assert.equal(
    formatWalletHuman(empty),
    [
      `Wallet          ${w.WALLET}`,
      'Current epoch   900',
      'Stake accounts  0',
      'RPC             rpc.example.com',
      '',
      'No stake accounts found for this wallet.',
      '',
    ].join('\n')
  );
});

test('formatWalletJson prints the report with the host as rpc', () => {
  const parsed = JSON.parse(formatWalletJson(REPORT));
  assert.equal(parsed.wallet, w.WALLET);
  assert.equal(parsed.epoch, 900);
  assert.equal(parsed.count, 3);
  assert.deepEqual(parsed.totals, REPORT.totals);
  assert.equal(parsed.accounts[0].address, fx.STAKE_ACCOUNT);
  assert.equal(parsed.accounts[0].role, 'staker');
  assert.equal(parsed.accounts[1].status, 'activating');
  assert.equal(parsed.accounts[2].delegation, null);
  assert.equal(parsed.rpc, 'rpc.example.com');
  assert.ok(!('host' in parsed));
});