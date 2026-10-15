'use strict';

const { parseArgs, UsageError } = require('./args');
const { createRpcClient, resolveRpcUrl, RpcError } = require('./rpc');
const { fetchStakeAccount, LookupError } = require('./account');
const { formatHuman, formatJson } = require('./format');
const { version } = require('../package.json');

const HELP = `sol-stake-info v${version}

Inspect a Solana stake account: state, validator, balance and epochs.
Read-only: never signs anything.

Usage:
  sol-stake-info <stake-account> [options]

Options:
  --rpc <url>    RPC endpoint (or set SOL_STAKE_INFO_RPC)
  --json         Print machine-readable JSON
  -h, --help     Show this help
  -v, --version  Show the version

Exit codes: 0 found, 1 not found / not a stake account / RPC error, 2 usage error.

Examples:
  sol-stake-info <stake-account-address>
  sol-stake-info <stake-account-address> --rpc https://api.devnet.solana.com --json
`;

async function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const env = io.env || process.env;

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

  const client = createRpcClient({
    url: resolveRpcUrl(opts.rpc, env),
    fetch: io.fetch,
    sleep: io.sleep,
  });

  try {
    const info = { ...(await fetchStakeAccount(client, opts.address)), host: client.host };
    stdout.write(opts.json ? formatJson(info) : formatHuman(info));
    return 0;
  } catch (err) {
    if (!(err instanceof RpcError) && !(err instanceof LookupError)) throw err;
    stderr.write(`Error: ${err.message}\n`);
    return 1;
  }
}

module.exports = { run, HELP };