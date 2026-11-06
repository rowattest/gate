// What a command needs from the outside world, passed in so the tests can supply their own.
export interface Context {
  out: (line: string) => void; // standard output
  err: (line: string) => void; // standard error
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  readStdin: () => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  apiBase: string; // https://app.rowattest.com in the command line tool; a local mock server in the tests
}

export const API_BASE = "https://app.rowattest.com";
export const VERSION = "0.1.0";
