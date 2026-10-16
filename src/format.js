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

// ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL -> "ATok...8knL"
function shortAddress(address) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// rows: arrays of strings; the columns listed in rightAligned are padded on the left.
function table(rows, rightAligned = []) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)));
  return rows
    .map((row) =>
      row
        .map((cell, col) => (rightAligned.includes(col) ? cell.padStart(widths[col]) : cell.padEnd(widths[col])))
        .join('  ')
        .trimEnd()
    )
    .join('\n');
}

// report: buildWalletReport(...) plus { host }
function formatWalletHuman(report) {
  const { totals, accounts } = report;
  const rows = [
    ['Wallet', report.wallet],
    ['Current epoch', String(report.epoch)],
    ['Stake accounts', String(accounts.length)],
  ];
  if (accounts.length > 0) {
    rows.push(['Total balance', formatSol(totals.lamports)]);
    if (totals.active > 0) rows.push(['Active', formatSol(totals.active)]);
    if (totals.activating > 0) rows.push(['Activating', formatSol(totals.activating)]);
    if (totals.deactivating > 0) rows.push(['Deactivating', formatSol(totals.deactivating)]);
  }
  rows.push(['RPC', report.host]);

  const summary = rows.map(([label, value]) => `${label.padEnd(16)}${value}`).join('\n');
  if (accounts.length === 0) return `${summary}\n\nNo stake accounts found for this wallet.\n`;

  const list = table(
    [
      ['Account', 'Status', 'Balance', 'Validator', 'Role'],
      ...accounts.map((a) => [
        a.address,
        a.status,
        formatSol(a.lamports),
        a.delegation ? shortAddress(a.delegation.voter) : '-',
        a.role,
      ]),
    ],
    [2]
  );
  return `${summary}\n\n${list}\n`;
}

function formatWalletJson(report) {
  return `${JSON.stringify(
    {
      wallet: report.wallet,
      epoch: report.epoch,
      count: report.accounts.length,
      totals: report.totals,
      accounts: report.accounts.map((a) => ({
        address: a.address,
        type: a.type,
        status: a.status,
        role: a.role,
        lamports: a.lamports,
        rentExemptReserve: a.rentExemptReserve,
        staker: a.staker,
        withdrawer: a.withdrawer,
        lockup: a.lockup,
        delegation: a.delegation,
        activation: a.activation,
      })),
      rpc: report.host,
    },
    null,
    2
  )}\n`;
}

module.exports = {
  formatHuman,
  formatJson,
  formatWalletHuman,
  formatWalletJson,
  formatSol,
  formatUtc,
  formatLockup,
  shortAddress,
  withCommas,
};