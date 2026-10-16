'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchEpoch, fetchStakeHistory, STAKE_HISTORY_SYSVAR } = require('../src/cluster');
const { LookupError } = require('../src/account');
const { createRpcClient } = require('../src/rpc');
const { createMockRpc } = require('./helpers/mock-rpc');
const fx = require('./helpers/stake-fixtures');

function clientFor(handlers) {
  const mock = createMockRpc(handlers);
  return { client: createRpcClient({ url: 'https://rpc.example.com', fetch: mock.fetch }), mock };
}

test('fetchEpoch returns the current epoch', async () => {
  const { client, mock } = clientFor({ getEpochInfo: fx.epochInfo(912) });
  assert.equal(await fetchEpoch(client), 912);
  assert.equal(mock.calls[0].method, 'getEpochInfo');
});

test('fetchEpoch rejects a response without an epoch', async () => {
  const { client } = clientFor({ getEpochInfo: { slotIndex: 1 } });
  await assert.rejects(fetchEpoch(client), (err) => err instanceof LookupError);
});

test('fetchStakeHistory reads the sysvar into a Map by epoch', async () => {
  const { client, mock } = clientFor({
    getAccountInfo: fx.stakeHistoryAccount([
      { epoch: 899, effective: 400000000000000000, activating: 1500000000000000, deactivating: 900000000000000 },
      { epoch: 898, effective: 399000000000000000, activating: 1200000000000000, deactivating: 800000000000000 },
    ]),
  });
  const history = await fetchStakeHistory(client);
  assert.equal(history.size, 2);
  assert.deepEqual(history.get(899), {
    effective: 400000000000000000,
    activating: 1500000000000000,
    deactivating: 900000000000000,
  });
  assert.deepEqual(mock.calls[0].params, [STAKE_HISTORY_SYSVAR, { encoding: 'jsonParsed' }]);
});

test('fetchStakeHistory accepts an empty history', async () => {
  const { client } = clientFor({ getAccountInfo: fx.stakeHistoryAccount([]) });
  assert.equal((await fetchStakeHistory(client)).size, 0);
});

test('fetchStakeHistory rejects a missing or malformed sysvar', async () => {
  const missing = clientFor({ getAccountInfo: { context: { slot: 1 }, value: null } });
  await assert.rejects(fetchStakeHistory(missing.client), (err) => err instanceof LookupError);

  const bad = fx.stakeHistoryAccount([{ epoch: 1, effective: 1, activating: 1, deactivating: 1 }]);
  bad.value.data.parsed.info[0].stakeHistory.effective = 'lots';
  await assert.rejects(fetchStakeHistory(clientFor({ getAccountInfo: bad }).client), /Could not read the stake history/);
});