'use strict';

// Shapes follow what getAccountInfo returns with encoding "jsonParsed" for a stake account.
const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
const NEVER = '18446744073709551615';

const STAKE_ACCOUNT = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const STAKER = 'So11111111111111111111111111111111111111112';
const WITHDRAWER = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const VOTER = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const CUSTODIAN = 'Cu7NwqCXSmsR5vgGA3Vw9uYVViPi3kQvkbKByVQ8nPY9';
const NO_CUSTODIAN = '11111111111111111111111111111111';
const STAKE_HISTORY_SYSVAR = 'SysvarStakeHistory1111111111111111111111111';

function wrap(parsed, { lamports = 1002282880, owner = STAKE_PROGRAM, program = 'stake' } = {}) {
  return {
    context: { slot: 350966785 },
    value: {
      data: { parsed, program, space: 200 },
      executable: false,
      lamports,
      owner,
      rentEpoch: 18446744073709551615,
      space: 200,
    },
  };
}

function meta(lockup = { custodian: NO_CUSTODIAN, epoch: 0, unixTimestamp: 0 }) {
  return {
    authorized: { staker: STAKER, withdrawer: WITHDRAWER },
    lockup,
    rentExemptReserve: '2282880',
  };
}

// 1 SOL delegated to VOTER since epoch 800, still active.
function delegatedAccount({ delegation = {}, lockup, lamports } = {}) {
  return wrap(
    {
      type: 'delegated',
      info: {
        meta: meta(lockup),
        stake: {
          creditsObserved: 58685367,
          delegation: {
            activationEpoch: '800',
            deactivationEpoch: NEVER,
            stake: '1000000000',
            voter: VOTER,
            warmupCooldownRate: 0.25,
            ...delegation,
          },
        },
      },
    },
    { lamports }
  );
}

// Created and funded, never delegated.
function initializedAccount({ lamports = 2282880 } = {}) {
  return wrap({ type: 'initialized', info: { meta: meta(), stake: null } }, { lamports });
}

function uninitializedAccount() {
  return wrap({ type: 'uninitialized' }, { lamports: 2282880 });
}

// getEpochInfo result
function epochInfo(epoch = 900) {
  return {
    absoluteSlot: 350966785,
    blockHeight: 340000000,
    epoch,
    slotIndex: 1000,
    slotsInEpoch: 432000,
    transactionCount: 1000000,
  };
}

// The stake history sysvar as jsonParsed returns it.
// entries: [{ epoch, effective, activating, deactivating }]
function stakeHistoryAccount(entries = []) {
  return {
    context: { slot: 350966785 },
    value: {
      data: {
        parsed: {
          type: 'stakeHistory',
          info: entries.map(({ epoch, effective, activating, deactivating }) => ({
            epoch,
            stakeHistory: { effective, activating, deactivating },
          })),
        },
        program: 'sysvar',
        space: 16392,
      },
      executable: false,
      lamports: 114979200,
      owner: 'Sysvar1111111111111111111111111111111111111',
      rentEpoch: 18446744073709551615,
      space: 16392,
    },
  };
}

// Mock RPC handlers for a whole lookup: the account, the current epoch and the stake history.
function lookupHandlers({ account = delegatedAccount(), epoch = 900, history = [] } = {}) {
  return {
    getEpochInfo: epochInfo(epoch),
    getAccountInfo: (params) => (params[0] === STAKE_HISTORY_SYSVAR ? stakeHistoryAccount(history) : account),
  };
}

module.exports = {
  STAKE_PROGRAM,
  STAKE_HISTORY_SYSVAR,
  epochInfo,
  stakeHistoryAccount,
  lookupHandlers,
  NEVER,
  STAKE_ACCOUNT,
  STAKER,
  WITHDRAWER,
  VOTER,
  CUSTODIAN,
  NO_CUSTODIAN,
  wrap,
  delegatedAccount,
  initializedAccount,
  uninitializedAccount,
};