'use strict';

const { LookupError } = require('./account');

const STAKE_HISTORY_SYSVAR = 'SysvarStakeHistory1111111111111111111111111';

async function fetchEpoch(client) {
  const result = await client.call('getEpochInfo');
  if (!result || !Number.isSafeInteger(result.epoch) || result.epoch < 0) {
    throw new LookupError(`Could not read the current epoch from ${client.host}`);
  }
  return result.epoch;
}

// Cluster-wide stake per epoch. Totals can pass 2^53 lamports, so these are plain
// numbers (like the f64s the stake program uses for the same maths), not safe integers.
function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Resolves to a Map of epoch -> { effective, activating, deactivating }
async function fetchStakeHistory(client) {
  const result = await client.call('getAccountInfo', [STAKE_HISTORY_SYSVAR, { encoding: 'jsonParsed' }]);
  const value = result && result.value;
  const entries = value && value.data && value.data.parsed && value.data.parsed.info;
  const unreadable = new LookupError(`Could not read the stake history from ${client.host}`);
  if (!Array.isArray(entries)) throw unreadable;

  const history = new Map();
  for (const entry of entries) {
    const amounts = (entry && entry.stakeHistory) || entry || {};
    const epoch = Number(entry && entry.epoch);
    const effective = toAmount(amounts.effective);
    const activating = toAmount(amounts.activating);
    const deactivating = toAmount(amounts.deactivating);
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw unreadable;
    if (effective === null || activating === null || deactivating === null) throw unreadable;
    history.set(epoch, { effective, activating, deactivating });
  }
  return history;
}

module.exports = { STAKE_HISTORY_SYSVAR, fetchEpoch, fetchStakeHistory };