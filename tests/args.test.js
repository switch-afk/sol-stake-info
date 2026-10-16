'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, UsageError } = require('../src/args');

const ADDRESS = 'Stake11111111111111111111111111111111111111';

test('parses a bare address with defaults', () => {
  assert.deepEqual(parseArgs([ADDRESS]), {
    address: ADDRESS,
    wallet: null,
    rpc: null,
    json: false,
    help: false,
    version: false,
  });
});

test('parses --json before or after the address', () => {
  assert.equal(parseArgs([ADDRESS, '--json']).json, true);
  assert.equal(parseArgs(['--json', ADDRESS]).json, true);
});

test('--json does not take a value', () => {
  assert.throws(() => parseArgs([ADDRESS, '--json=yes']), /--json does not take a value/);
});

test('parses --rpc in both forms', () => {
  assert.equal(parseArgs([ADDRESS, '--rpc', 'https://rpc.example.com']).rpc, 'https://rpc.example.com');
  assert.equal(parseArgs([ADDRESS, '--rpc=http://localhost:8899']).rpc, 'http://localhost:8899');
});

test('--rpc needs a value', () => {
  assert.throws(() => parseArgs([ADDRESS, '--rpc']), /--rpc needs a URL/);
  assert.throws(() => parseArgs([ADDRESS, '--rpc=']), /--rpc needs a URL/);
  assert.throws(() => parseArgs([ADDRESS, '--rpc', '--json']), /--rpc needs a URL/);
});

test('--rpc must be an http(s) URL', () => {
  assert.throws(() => parseArgs([ADDRESS, '--rpc', 'not a url']), /valid http\(s\) URL/);
  assert.throws(() => parseArgs([ADDRESS, '--rpc', 'ftp://rpc.example.com']), /valid http\(s\) URL/);
});

test('--rpc can only be given once', () => {
  assert.throws(
    () => parseArgs([ADDRESS, '--rpc', 'https://a.example.com', '--rpc', 'https://b.example.com']),
    /can only be given once/
  );
});

test('parses --wallet in both forms, without a stake account address', () => {
  const opts = parseArgs(['--wallet', ADDRESS]);
  assert.equal(opts.wallet, ADDRESS);
  assert.equal(opts.address, null);
  assert.equal(parseArgs([`--wallet=${ADDRESS}`, '--json']).wallet, ADDRESS);
});

test('--wallet needs a valid address and can only be given once', () => {
  assert.throws(() => parseArgs(['--wallet']), /--wallet needs an address/);
  assert.throws(() => parseArgs(['--wallet', '--json']), /--wallet needs an address/);
  assert.throws(() => parseArgs(['--wallet', 'nope']), /is not a valid Solana address/);
  assert.throws(() => parseArgs(['--wallet', ADDRESS, '--wallet', ADDRESS]), /can only be given once/);
});

test('a stake account address and --wallet cannot be combined', () => {
  assert.throws(() => parseArgs([ADDRESS, '--wallet', ADDRESS]), /either a stake account address or --wallet/);
});

test('--help and --version work in both forms, without an address', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--version']).version, true);
  assert.equal(parseArgs(['-v']).version, true);
});

test('missing address is a usage error', () => {
  assert.throws(() => parseArgs([]), UsageError);
  assert.throws(() => parseArgs(['--json']), /Missing stake account address \(or use --wallet <address>\)/);
});

test('invalid address is a usage error', () => {
  assert.throws(() => parseArgs(['not-an-address']), /is not a valid Solana address/);
  assert.throws(() => parseArgs(['not-an-address']), UsageError);
});

test('unknown options are usage errors', () => {
  assert.throws(() => parseArgs([ADDRESS, '--nope']), /Unknown option: --nope/);
  assert.throws(() => parseArgs([ADDRESS, '-x']), /Unknown option: -x/);
  assert.throws(() => parseArgs([ADDRESS, '--nope=1']), /Unknown option: --nope/);
});

test('a second address is a usage error', () => {
  assert.throws(() => parseArgs([ADDRESS, ADDRESS]), /Only one stake account address/);
});