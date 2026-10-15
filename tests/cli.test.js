'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/cli');
const { version } = require('../package.json');

const ADDRESS = 'Stake11111111111111111111111111111111111111';

function sink() {
  return {
    data: '',
    write(chunk) {
      this.data += chunk;
    },
  };
}

test('--help prints usage and exits 0', async () => {
  const stdout = sink();
  const code = await run(['--help'], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.match(stdout.data, /Usage:/);
  assert.match(stdout.data, /--json/);
});

test('--version prints the package version', async () => {
  const stdout = sink();
  const code = await run(['--version'], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.equal(stdout.data.trim(), version);
});

test('usage errors exit 2, print to stderr and leave stdout empty', async () => {
  const stdout = sink();
  const stderr = sink();
  const code = await run([], { stdout, stderr });
  assert.equal(code, 2);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /Error: Missing stake account address/);
  assert.match(stderr.data, /Usage:/);
});

test('an invalid address exits 2', async () => {
  const stdout = sink();
  const stderr = sink();
  const code = await run(['nope'], { stdout, stderr });
  assert.equal(code, 2);
  assert.equal(stdout.data, '');
  assert.match(stderr.data, /is not a valid Solana address/);
});

test('a valid address is echoed back', async () => {
  const stdout = sink();
  const code = await run([ADDRESS], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.match(stdout.data, /Stake account {2}Stake11111111111111111111111111111111111111/);
});

test('--json prints the address as JSON', async () => {
  const stdout = sink();
  const code = await run([ADDRESS, '--json'], { stdout, stderr: sink() });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout.data), { address: ADDRESS });
});