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
  return `until ${until.join(' and ')} (custodian ${lockup.custodian})`;
}

// info: fetchStakeAccount(...) plus { host }
function formatHuman(info) {
  const rows = [
    ['Stake account', info.address],
    ['State', info.state],
    ['Balance', formatSol(info.lamports)],
  ];

  const d = info.delegation;
  if (d) {
    rows.push(['Delegated', formatSol(d.stake)]);
    rows.push(['Validator', d.voter]);
    if (d.activationEpoch !== null) rows.push(['Activated', `epoch ${d.activationEpoch}`]);
    if (d.deactivationEpoch !== null) rows.push(['Deactivated', `epoch ${d.deactivationEpoch}`]);
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
      state: info.state,
      lamports: info.lamports,
      rentExemptReserve: info.rentExemptReserve,
      staker: info.staker,
      withdrawer: info.withdrawer,
      lockup: info.lockup,
      delegation: info.delegation,
      rpc: info.host,
    },
    null,
    2
  )}\n`;
}

module.exports = { formatHuman, formatJson, formatSol, formatUtc, formatLockup, withCommas };