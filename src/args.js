'use strict';

const { isValidAddress } = require('./address');

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const FLAG_OPTIONS = {
  '--json': 'json',
};

function parseArgs(argv) {
  const opts = {
    address: null,
    json: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    let name = arg;
    let inline = null;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        name = arg.slice(0, eq);
        inline = arg.slice(eq + 1);
      }
    }

    if (name === '--help' || name === '-h') {
      opts.help = true;
    } else if (name === '--version' || name === '-v') {
      opts.version = true;
    } else if (FLAG_OPTIONS[name]) {
      if (inline !== null) throw new UsageError(`${name} does not take a value`);
      opts[FLAG_OPTIONS[name]] = true;
    } else if (arg.startsWith('-')) {
      throw new UsageError(`Unknown option: ${name}`);
    } else if (opts.address === null) {
      opts.address = arg;
    } else {
      throw new UsageError('Only one stake account address can be given');
    }
  }

  if (!opts.help && !opts.version) {
    if (opts.address === null) throw new UsageError('Missing stake account address');
    if (!isValidAddress(opts.address)) {
      throw new UsageError(`"${opts.address}" is not a valid Solana address`);
    }
  }

  return opts;
}

module.exports = { parseArgs, UsageError };