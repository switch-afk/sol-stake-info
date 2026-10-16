'use strict';

// 432000 -> "432,000". Done by hand so the output does not depend on the locale.
function withCommas(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 1002282880 -> "1.00228288 SOL". Whole-number maths only, so nothing is rounded.
function formatSol(lamports) {
  const rest = lamports % 1e9;
  const whole = (lamports - rest) / 1e9;
  const fraction = String(rest).padStart(9, '0').replace(/0+$/, '');
  return `${withCommas(whole)}${fraction ? `.${fraction}` : ''} SOL`;
}

// 1796083200 -> "2026-12-01 00:00 UTC"
function formatUtc(unixSeconds) {
  const iso = new Date(unixSeconds * 1000).toISOString();
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`;
}

// A lockup holds until both the epoch and the time have passed.
function formatLockup(lockup) {
  if (!lockup) return 'none';
  const until = [];
  if (lockup.epoch > 0) until.push(`epoch ${lockup.epoch}`);
  if (lockup.unixTimestamp > 0) until.push(formatUtc(lockup.unixTimestamp));
  const range = until.join(' and ');
  return lockup.inForce
    ? `in force until ${range} (custodian ${lockup.custodian})`
    : `expired (was until ${range})`;
}

// info: fetchStakeAccount(...) plus deriveStatus(...) plus { host }
function formatHuman(info) {
  const rows = [
    ['Stake account', info.address],
    ['Status', info.status],
    ['Current epoch', String(info.epoch)],
    ['Balance', formatSol(info.lamports)],
  ];

  const d = info.delegation;
  const a = info.activation;
  if (d) {
    rows.push(['Delegated', formatSol(d.stake)]);
    if (a.effective > 0) rows.push(['Active', formatSol(a.effective)]);
    if (a.activating > 0) rows.push(['Activating', formatSol(a.activating)]);
    if (a.deactivating > 0) rows.push(['Deactivating', formatSol(a.deactivating)]);
    rows.push(['Validator', d.voter]);
    if (d.activationEpoch !== null) rows.push(['Activation', `epoch ${d.activationEpoch}`]);
    if (d.deactivationEpoch !== null) rows.push(['Deactivation', `epoch ${d.deactivationEpoch}`]);
  }

  if (info.rentExemptReserve !== null) rows.push(['Rent reserve', formatSol(info.rentExemptReserve)]);
  if (info.staker !== null) {
    rows.push(['Staker', info.staker]);
    rows.push(['Withdrawer', info.withdrawer]);
    rows.push(['Lockup', formatLockup(info.lockup)]);
  }
  rows.push(['RPC', info.host]);

  return `${rows.map(([label, value]) => `${label.padEnd(15)}${value}`).join('\n')}\n`;
}

function formatJson(info) {
  return `${JSON.stringify(
    {
      address: info.address,
      type: info.type,
      status: info.status,
      epoch: info.epoch,
      lamports: info.lamports,
      rentExemptReserve: info.rentExemptReserve,
      staker: info.staker,
      withdrawer: info.withdrawer,
      lockup: info.lockup,
      delegation: info.delegation,
      activation: info.activation,
      rpc: info.host,
    },
    null,
    2
  )}\n`;
}

module.exports = { formatHuman, formatJson, formatSol, formatUtc, formatLockup, withCommas };