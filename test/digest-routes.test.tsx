import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function makeRunsDir(): string {
  return mkdtempSync(join(tmpdir(), 'rig-test-'));
}

const BASE_CONFIG = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

describe('digest page (§2a)', () => {
  it('returns 200 with a table for a night that has a file', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n' +
      '{"at":"2026-10-28T23:01:00+01:00","job":"lane/sync","status":"fail","owner":"rook","error":"timeout"}\n',
    );
    const res = await createApp({ ...BASE_CONFIG, runsDir }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
    expect(html).toContain('lane/sync');
  });

  it('returns 404 for a night with no file', async () => {
    const runsDir = makeRunsDir();
    const res = await createApp({ ...BASE_CONFIG, runsDir }).request('/digest/2026-10-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('not found');
  });

  it('renders "nothing ran" for an empty night file', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const res = await createApp({ ...BASE_CONFIG, runsDir }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('renders 200 and does not throw when a file contains unparseable lines', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      'NOT JSON AT ALL\n' +
      '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n' +
      '{broken\n',
    );
    const res = await createApp({ ...BASE_CONFIG, runsDir }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
  });
});

describe('digest JSON (§2b)', () => {
  it('returns 200 JSON array for a night that has a file', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n' +
      '{"at":"2026-10-28T23:01:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\n',
    );
    const res = await createApp({ ...BASE_CONFIG, runsDir }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const json = await res.json() as Array<{ job: string }>;
    expect(Array.isArray(json)).toBe(true);
    expect(json.map((r) => r.job)).toEqual(['lane/sync', 'rig/rotate-logs']);
  });

  it('returns 404 JSON for a night with no file', async () => {
    const runsDir = makeRunsDir();
    const res = await createApp({ ...BASE_CONFIG, runsDir }).request('/api/digest/2026-10-01');
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBeTruthy();
  });

  it('JSON job order matches page job order', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      '{"at":"2026-10-28T23:01:00+01:00","job":"z-job","status":"ok","owner":"rook"}\n' +
      '{"at":"2026-10-28T23:00:02+01:00","job":"a-job","status":"fail","owner":"lane-07","error":"boom"}\n' +
      '{"at":"2026-10-28T23:02:00+01:00","job":"m-job","status":"retry","owner":"rook"}\n',
    );
    const app = createApp({ ...BASE_CONFIG, runsDir });
    const [pageRes, jsonRes] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    const html = await pageRes.text();
    const json = await jsonRes.json() as Array<{ job: string }>;
    const jsonOrder = json.map((r) => r.job);
    // Verify page contains jobs in the same order as JSON
    let lastIdx = -1;
    for (const job of jsonOrder) {
      const idx = html.indexOf(job);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
    expect(jsonOrder).toEqual(['a-job', 'm-job', 'z-job']);
  });
});
