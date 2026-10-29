// The night's run log, read into one row per job. Section 2 builds against this type.
export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null; // null in the log → kept, shown as — by the view
  runs: number; // lines seen for this job
  retries: number; // lines with status "retry"
  lastStatus: JobStatus; // status of the latest line, by time
  lastError: string | null; // error on the latest line, or null
  firstAt: string; // earliest `at`, kept as written (styleguide: no UTC)
  lastAt: string; // latest `at`
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse, counted not thrown
};

// null when the night has no file at all (the page turns that into 404).
// An empty file is a Night with no rows (the page renders "nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
