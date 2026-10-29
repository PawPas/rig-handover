import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('folds 2026-10-28 into 5 jobs with 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows).toHaveLength(5);
    // sorted by job
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last status and error', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const byJob = Object.fromEntries(rows.map((r) => [r.job, r]));

    expect(byJob['fixtures/refresh']).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(byJob['notes/backup']).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['lane/sync']).toMatchObject({ retries: 1, lastStatus: 'ok' });
  });

  it('keeps a null owner rather than dropping the row', () => {
    const render = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(render).toBeDefined();
    expect(render!.owner).toBeNull();
  });

  it('returns null when the night has no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
