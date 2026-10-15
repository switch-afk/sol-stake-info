'use strict';

const { parseArgs, UsageError } = require('./args');
const { version } = require('../package.json');

const HELP = `sol-stake-info v${version}

Inspect a Solana stake account: state, validator, balance and epochs.
Read-only: never signs anything.

Usage:
  sol-stake-info <stake-account> [options]

Options:
  --json         Print machine-readable JSON
  -h, --help     Show this help
  -v, --version  Show the version

Examples:
  sol-stake-info <stake-account-address>
  sol-stake-info <stake-account-address> --json
`;

async function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;

  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      stderr.write(`Error: ${err.message}\n\n${HELP}`);
      return 2;
    }
    throw err;
  }

  if (opts.help) {
    stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    stdout.write(`${version}\n`);
    return 0;
  }

  if (opts.json) {
    stdout.write(`${JSON.stringify({ address: opts.address }, null, 2)}\n`);
  } else {
    stdout.write(`Stake account  ${opts.address}\n`);
  }
  return 0;
}

module.exports = { run, HELP };