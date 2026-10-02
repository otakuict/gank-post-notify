import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUtc7 } from '../src/time.js';

test('formatUtc7 converts an ISO timestamp to Bangkok time', () => {
  assert.equal(
    formatUtc7('2026-09-15T16:23:23Z'),
    '2026-09-15 23:23:23 (UTC+7)',
  );
});

test('formatUtc7 returns null for an invalid timestamp', () => {
  assert.equal(formatUtc7('not-a-date'), null);
});
