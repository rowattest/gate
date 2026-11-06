// A failure the command line reports as one plain line, with the exit code it maps to.
// Exit codes: 1 invalid or an API refusal or a network failure; 2 usage, unreadable input or a bad key list; 4 a wait that ran out.
export class CliError extends Error {
  readonly code: number;
  constructor(code: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}
