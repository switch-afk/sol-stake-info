'use strict';

const { STAKE_PROGRAM, LookupError, readStakeAccount } = require('./account');
const { RpcError } = require('./rpc');
const { deriveStatus } = require('./activation');

// Stake account layout: 4-byte state tag, 8-byte rent reserve, then the staker (32 bytes)
// and the withdrawer (32 bytes). Every stake account is 200 bytes.
const STAKER_OFFSET = 12;
const WITHDRAWER_OFFSET = 44;
const STAKE_ACCOUNT_SIZE = 200;

async function queryByAuthority(client, wallet, offset) {
  let result;
  try {
    result = await client.call('getProgramAccounts', [
      STAKE_PROGRAM,
      {
        encoding: 'jsonParsed',
        filters: [{ dataSize: STAKE_ACCOUNT_SIZE }, { memcmp: { offset, bytes: wallet } }],
      },
    ]);
  } catch (err) {
    // A server that answered with an error is usually blocking or limiting this method.
    if (err instanceof RpcError && (err.code !== undefined || err.status !== undefined)) {
      throw new LookupError(
        `${err.message}. getProgramAccounts is often blocked or rate limited on public RPC endpoints; try --rpc with your own endpoint`
      );
    }
    throw err;
  }
  if (!Array.isArray(result)) {
    throw new LookupError(`Could not read the stake accounts from ${client.host}`);
  }
  return result;
}

function roleOf(account, wallet) {
  if (account.staker === wallet) return account.withdrawer === wallet ? 'both' : 'staker';
  return 'withdrawer';
}

// Every stake account where the wallet is the staker or the withdrawer, each listed once.
// Resolves to an array of fetchStakeAccount-style results plus { role }.
async function fetchWalletStakeAccounts(client, wallet) {
  const [asStaker, asWithdrawer] = await Promise.all([
    queryByAuthority(client, wallet, STAKER_OFFSET),
    queryByAuthority(client, wallet, WITHDRAWER_OFFSET),
  ]);

  const byAddress = new Map();
  for (const entry of [...asStaker, ...asWithdrawer]) {
    if (!entry || typeof entry.pubkey !== 'string' || !entry.account) {
      throw new LookupError(`Could not read the stake accounts from ${client.host}`);
    }
    if (byAddress.has(entry.pubkey)) continue;
    byAddress.set(entry.pubkey, readStakeAccount(entry.pubkey, entry.account));
  }

  return [...byAddress.values()].map((account) => ({ ...account, role: roleOf(account, wallet) }));
}

function sum(rows, pick) {
  const total = rows.reduce((t, row) => t + pick(row), 0);
  if (!Number.isSafeInteger(total)) {
    throw new LookupError('The total is too large to show exactly');
  }
  return total;
}

// accounts: fetchWalletStakeAccounts(...) result
// Resolves to { wallet, epoch, accounts, totals } with the biggest account first.
function buildWalletReport(wallet, accounts, { epoch, history, now }) {
  const rows = accounts
    .map((account) => ({ ...account, ...deriveStatus(account, { epoch, history, now }) }))
    .sort((a, b) => b.lamports - a.lamports || (a.address < b.address ? -1 : 1));

  return {
    wallet,
    epoch,
    accounts: rows,
    totals: {
      lamports: sum(rows, (r) => r.lamports),
      active: sum(rows, (r) => (r.activation ? r.activation.effective : 0)),
      activating: sum(rows, (r) => (r.activation ? r.activation.activating : 0)),
      deactivating: sum(rows, (r) => (r.activation ? r.activation.deactivating : 0)),
    },
  };
}

module.exports = {
  STAKER_OFFSET,
  WITHDRAWER_OFFSET,
  STAKE_ACCOUNT_SIZE,
  fetchWalletStakeAccounts,
  buildWalletReport,
};