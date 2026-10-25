'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { snapshot } = require('../src/lib/health');

test('health snapshot contains safe operational metrics', () => {
  const h = snapshot();
  assert.equal(typeof h.uptimeSeconds, 'number');
  assert.equal(typeof h.processUptimeSeconds, 'number');
  assert.equal(typeof h.memory.rssBytes, 'number');
  assert.ok(h.memory.rssBytes > 0);
  assert.ok(h.cpuCount >= 1);
  assert.match(h.node, /^v\d+/);
  assert.ok(h.hostMemory.usedPercent === null || (h.hostMemory.usedPercent >= 0 && h.hostMemory.usedPercent <= 100));
});
