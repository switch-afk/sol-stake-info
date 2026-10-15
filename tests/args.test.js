'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, UsageError } = require('../src/args');

const ADDRESS = 'Stake11111111111111111111111111111111111111';

test('parses a bare address with defaults', () => {
  assert.deepEqual(parseArgs([ADDRESS]), {
    address: ADDRESS,
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

test('--help and --version work in both forms, without an address', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--version']).version, true);
  assert.equal(parseArgs(['-v']).version, true);
});

test('missing address is a usage error', () => {
  assert.throws(() => parseArgs([]), UsageError);
  assert.throws(() => parseArgs(['--json']), /Missing stake account address/);
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