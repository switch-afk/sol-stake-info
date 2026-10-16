'use strict';

const { isValidAddress } = require('./address');

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

function checkRpcUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UsageError('--rpc must be a valid http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError('--rpc must be a valid http(s) URL');
  }
  return value;
}

function checkAddress(value) {
  if (!isValidAddress(value)) {
    throw new UsageError(`"${value}" is not a valid Solana address`);
  }
  return value;
}

const VALUE_OPTIONS = {
  '--rpc': { key: 'rpc', needs: 'a URL', parse: checkRpcUrl },
  '--wallet': { key: 'wallet', needs: 'an address', parse: checkAddress },
};

const FLAG_OPTIONS = {
  '--json': 'json',
};

function parseArgs(argv) {
  const opts = {
    address: null,
    wallet: null,
    rpc: null,
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
    } else if (VALUE_OPTIONS[name]) {
      const { key, needs, parse } = VALUE_OPTIONS[name];
      let value = inline;
      if (value === null) {
        value = argv[++i];
        if (value === undefined || value.startsWith('-')) {
          throw new UsageError(`${name} needs ${needs}`);
        }
      }
      if (value === '') {
        throw new UsageError(`${name} needs ${needs}`);
      }
      if (opts[key] !== null) throw new UsageError(`${name} can only be given once`);
      opts[key] = parse(value);
    } else if (arg.startsWith('-')) {
      throw new UsageError(`Unknown option: ${name}`);
    } else if (opts.address === null) {
      opts.address = arg;
    } else {
      throw new UsageError('Only one stake account address can be given');
    }
  }

  if (!opts.help && !opts.version) {
    if (opts.address !== null && opts.wallet !== null) {
      throw new UsageError('Give either a stake account address or --wallet, not both');
    }
    if (opts.address === null && opts.wallet === null) {
      throw new UsageError('Missing stake account address (or use --wallet <address>)');
    }
    if (opts.address !== null && !isValidAddress(opts.address)) {
      throw new UsageError(`"${opts.address}" is not a valid Solana address`);
    }
  }

  return opts;
}

module.exports = { parseArgs, UsageError };