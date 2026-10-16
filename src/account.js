'use strict';

const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';

// The stake program stores "never" as the largest u64.
const NEVER = '18446744073709551615';

class LookupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LookupError';
  }
}

// The RPC sends big numbers as strings and small ones as numbers; accept both.
function toNumber(value, what) {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new LookupError(`Could not read the ${what} from the account data`);
  }
  return n;
}

function toEpoch(value, what) {
  return String(value) === NEVER ? null : toNumber(value, what);
}

// No lockup at all is epoch 0 and timestamp 0.
function readLockup(lockup) {
  if (!lockup) return null;
  const epoch = toNumber(lockup.epoch, 'lockup epoch');
  const unixTimestamp = toNumber(lockup.unixTimestamp, 'lockup time');
  if (epoch === 0 && unixTimestamp === 0) return null;
  return { custodian: lockup.custodian, epoch, unixTimestamp };
}

function readDelegation(stake) {
  if (!stake || !stake.delegation) return null;
  const d = stake.delegation;
  return {
    voter: d.voter,
    stake: toNumber(d.stake, 'delegated stake'),
    activationEpoch: toEpoch(d.activationEpoch, 'activation epoch'),
    deactivationEpoch: toEpoch(d.deactivationEpoch, 'deactivation epoch'),
    creditsObserved: toNumber(stake.creditsObserved, 'credits observed'),
  };
}

// client: { call, host } from createRpcClient
// Resolves to { address, type, lamports, rentExemptReserve, staker, withdrawer, lockup, delegation }
async function fetchStakeAccount(client, address) {
  const result = await client.call('getAccountInfo', [address, { encoding: 'jsonParsed' }]);
  const account = result && result.value;

  if (!account) {
    throw new LookupError(`No account found at ${address} on ${client.host}`);
  }
  if (account.owner !== STAKE_PROGRAM) {
    throw new LookupError(`${address} is not a stake account (owned by ${account.owner})`);
  }

  const unreadable = new LookupError(`Could not read the stake data of ${address}`);
  const data = account.data;
  if (!data || data.program !== 'stake' || !data.parsed) throw unreadable;

  try {
    const parsed = data.parsed;
    const info = parsed.info || {};
    const meta = info.meta || null;
    return {
      address,
      type: parsed.type,
      lamports: toNumber(account.lamports, 'balance'),
      rentExemptReserve: meta ? toNumber(meta.rentExemptReserve, 'rent reserve') : null,
      staker: meta ? meta.authorized.staker : null,
      withdrawer: meta ? meta.authorized.withdrawer : null,
      lockup: meta ? readLockup(meta.lockup) : null,
      delegation: readDelegation(info.stake),
    };
  } catch (err) {
    if (err instanceof LookupError) throw err;
    throw unreadable;
  }
}

module.exports = { STAKE_PROGRAM, NEVER, LookupError, fetchStakeAccount };