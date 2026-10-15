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

module.exports = {
  STAKE_PROGRAM,
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