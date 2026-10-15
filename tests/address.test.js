'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeBase58, isValidAddress } = require('../src/address');

test('accepts well-known valid addresses', () => {
  assert.equal(isValidAddress('11111111111111111111111111111111'), true);
  assert.equal(isValidAddress('So11111111111111111111111111111111111111112'), true);
  assert.equal(isValidAddress('Stake11111111111111111111111111111111111111'), true);
});

test('rejects wrong length', () => {
  assert.equal(isValidAddress('abc'), false);
  assert.equal(isValidAddress('1'.repeat(45)), false);
});

test('rejects characters outside the base58 alphabet', () => {
  assert.equal(isValidAddress('0take11111111111111111111111111111111111111'), false);
  assert.equal(isValidAddress('Stake1111111111111111111111111111 1111111111'), false);
});

test('rejects non-strings', () => {
  assert.equal(isValidAddress(undefined), false);
  assert.equal(isValidAddress(42), false);
});

test('decodeBase58 gives 32 bytes for an address and null for bad input', () => {
  assert.equal(decodeBase58('Stake11111111111111111111111111111111111111').length, 32);
  assert.equal(decodeBase58('0OIl'), null);
});