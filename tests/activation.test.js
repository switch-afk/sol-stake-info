'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stakeActivation, deriveStatus } = require('../src/activation');

function delegation(overrides = {}) {
  return {
    voter: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    stake: 1000,
    activationEpoch: 100,
    deactivationEpoch: null,
    creditsObserved: 1,
    ...overrides,
  };
}

function historyOf(entries) {
  return new Map(entries.map(([epoch, effective, activating, deactivating]) => [epoch, { effective, activating, deactivating }]));
}

const NONE = new Map();

test('in the activation epoch everything is activating', () => {
  assert.deepEqual(stakeActivation(delegation(), 100, NONE), {
    status: 'activating',
    effective: 0,
    activating: 1000,
    deactivating: 0,
  });
});

test('before the activation epoch nothing has started', () => {
  assert.equal(stakeActivation(delegation(), 99, NONE).status, 'inactive');
});

test('a small stake finishes warming up in one epoch', () => {
  // weight 1e9/1e12 = 0.001, the cluster may add 9e13 (9% of 1e15), so this stake gets 9e10, more than it needs
  const history = historyOf([[100, 1e15, 1e12, 0]]);
  assert.deepEqual(stakeActivation(delegation({ stake: 1e9 }), 101, history), {
    status: 'active',
    effective: 1e9,
    activating: 0,
    deactivating: 0,
  });
});

test('warmup is throttled by the cluster-wide rate', () => {
  // weight 1000/4000 = 0.25, the cluster may add 90 (9% of 1000), so this stake gets floor(22.5) = 22
  const history = historyOf([[100, 1000, 4000, 0]]);
  assert.deepEqual(stakeActivation(delegation(), 101, history), {
    status: 'activating',
    effective: 22,
    activating: 978,
    deactivating: 0,
  });
});

test('warmup continues across epochs using each epoch of history', () => {
  // second step: weight 978/3978, the cluster may add 91.98, so floor(22.61) = 22 more
  const history = historyOf([
    [100, 1000, 4000, 0],
    [101, 1022, 3978, 0],
  ]);
  const result = stakeActivation(delegation(), 102, history);
  assert.equal(result.effective, 44);
  assert.equal(result.activating, 956);
  assert.equal(result.status, 'activating');
});

test('stake whose activation epoch is not in the history is fully active', () => {
  assert.deepEqual(stakeActivation(delegation(), 500, NONE), {
    status: 'active',
    effective: 1000,
    activating: 0,
    deactivating: 0,
  });
});

test('bootstrap stake (no activation epoch) is active', () => {
  const result = stakeActivation(delegation({ activationEpoch: null }), 5, NONE);
  assert.equal(result.status, 'active');
  assert.equal(result.effective, 1000);
});

test('activated and deactivated in the same epoch is inactive', () => {
  const result = stakeActivation(delegation({ activationEpoch: 100, deactivationEpoch: 100 }), 100, NONE);
  assert.equal(result.status, 'inactive');
});

test('stake that has not been deactivated yet keeps its activating amount', () => {
  const history = historyOf([[100, 1000, 4000, 0]]);
  const result = stakeActivation(delegation({ deactivationEpoch: 150 }), 101, history);
  assert.equal(result.status, 'activating');
  assert.equal(result.deactivating, 0);
});

test('in the deactivation epoch the effective stake is deactivating', () => {
  assert.deepEqual(stakeActivation(delegation({ deactivationEpoch: 110 }), 110, NONE), {
    status: 'deactivating',
    effective: 1000,
    activating: 0,
    deactivating: 1000,
  });
});

test('cooldown is throttled by the cluster-wide rate', () => {
  // weight 100/500 = 0.2, the cluster may release 90 (9% of 1000), so this stake releases floor(18) = 18
  const history = historyOf([[110, 1000, 0, 500]]);
  assert.deepEqual(stakeActivation(delegation({ stake: 100, deactivationEpoch: 110 }), 111, history), {
    status: 'deactivating',
    effective: 82,
    activating: 0,
    deactivating: 82,
  });
});

test('a small stake finishes cooling down in one epoch', () => {
  const history = historyOf([[110, 1e15, 0, 1e12]]);
  const result = stakeActivation(delegation({ stake: 1e9, deactivationEpoch: 110 }), 111, history);
  assert.deepEqual(result, { status: 'inactive', effective: 0, activating: 0, deactivating: 0 });
});

test('a deactivation epoch missing from the history means fully deactivated', () => {
  const result = stakeActivation(delegation({ deactivationEpoch: 110 }), 500, NONE);
  assert.equal(result.status, 'inactive');
  assert.equal(result.effective, 0);
});

test('deriveStatus: delegated accounts get the activation status and amounts', () => {
  const info = { type: 'delegated', lockup: null, delegation: delegation() };
  const result = deriveStatus(info, { epoch: 500, history: NONE, now: 1700000000 });
  assert.deepEqual(result, {
    epoch: 500,
    status: 'active',
    activation: { effective: 1000, activating: 0, deactivating: 0 },
    lockup: null,
  });
});

test('deriveStatus: undelegated and other accounts have no activation', () => {
  const initialized = deriveStatus({ type: 'initialized', lockup: null, delegation: null }, { epoch: 5, history: null, now: 0 });
  assert.equal(initialized.status, 'undelegated');
  assert.equal(initialized.activation, null);

  const uninitialized = deriveStatus({ type: 'uninitialized', lockup: null, delegation: null }, { epoch: 5, history: null, now: 0 });
  assert.equal(uninitialized.status, 'uninitialized');
});

test('deriveStatus: a lockup is in force until both its epoch and its time have passed', () => {
  const lockup = { custodian: 'C', epoch: 900, unixTimestamp: 1796083200 };
  const info = { type: 'initialized', lockup, delegation: null };
  const at = (epoch, now) => deriveStatus(info, { epoch, history: null, now }).lockup.inForce;

  assert.equal(at(899, 1796083201), true); // epoch not reached
  assert.equal(at(900, 1796083199), true); // time not reached
  assert.equal(at(900, 1796083200), false); // both reached
  assert.equal(at(901, 1796083201), false);
});