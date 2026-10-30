import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, StatusCounts } from './types.js';

const STATUSES: ReadonlySet<string> = new Set(['ok', 'retry', 'fail']);

type Line = { at: string; job: string; status: JobStatus; owner: string | null; error?: string };

// Parse one log line. Returns null when it doesn't parse or lacks the fields a row needs;
// the caller counts those, never throws (plan § 1).
function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.has(o.status)) return null;
  const owner = o.owner === null || typeof o.owner === 'string' ? ((o.owner as string | null) ?? null) : null;
  const line: Line = { at: o.at, job: o.job, status: o.status as JobStatus, owner };
  if (typeof o.error === 'string') line.error = o.error;
  return line;
}

function fold(lines: Line[]): DigestRow[] {
  const byJob = new Map<string, DigestRow>();
  for (const l of lines) {
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error ?? null,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    row.runs += 1;
    if (l.status === 'retry') row.retries += 1;
    if (l.at < row.firstAt) row.firstAt = l.at;
    if (l.at >= row.lastAt) {
      // Latest line by time wins for owner, status and error.
      row.lastAt = l.at;
      row.lastStatus = l.status;
      row.lastError = l.error ?? null;
      row.owner = l.owner;
    }
  }
  return [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
}

// Read runs/<night>.jsonl into one row per job. Missing file → null (page → 404).
// Empty file → a Night with no rows (page → "nothing ran"). Bad lines are counted.
export function readNight(runsDir: string, night: string): Night | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const lines: Line[] = [];
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const parsed = parseLine(raw);
    if (parsed) {
      lines.push(parsed);
      counts[parsed.status] += 1;
    } else {
      badLines += 1;
    }
  }
  return { night, rows: fold(lines), counts, badLines };
}
