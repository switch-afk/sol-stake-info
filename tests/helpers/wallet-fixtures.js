'use strict';

const fx = require('./stake-fixtures');

const WALLET = fx.STAKER;
const STAKE_ACCOUNT_2 = 'Vote111111111111111111111111111111111111111';
const STAKE_ACCOUNT_3 = 'Config1111111111111111111111111111111111111';

// A copy of a stake account fixture with different authorities.
function withAuthorized(account, staker, withdrawer) {
  const copy = JSON.parse(JSON.stringify(account));
  const { authorized } = copy.value.data.parsed.info.meta;
  authorized.staker = staker;
  authorized.withdrawer = withdrawer;
  return copy;
}

// One item of a getProgramAccounts result.
function entry(pubkey, account) {
  return { pubkey, account: account.value };
}

// Mock handlers for a wallet listing. getProgramAccounts answers the staker query (offset 12)
// with asStaker and the withdrawer query (offset 44) with asWithdrawer.
function walletHandlers({ asStaker = [], asWithdrawer = [], epoch = 900, history = [] } = {}) {
  return {
    getEpochInfo: fx.epochInfo(epoch),
    getProgramAccounts: (params) => (params[1].filters[1].memcmp.offset === 12 ? asStaker : asWithdrawer),
    getAccountInfo: () => fx.stakeHistoryAccount(history),
  };
}

module.exports = { WALLET, STAKE_ACCOUNT_2, STAKE_ACCOUNT_3, withAuthorized, entry, walletHandlers };