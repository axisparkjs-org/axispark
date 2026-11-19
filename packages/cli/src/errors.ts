import chalk from 'chalk';

/**
 * The error thrown when the user cancels a prompt (Ctrl+C or Esc). The CLI exits with the code `130`, as a process interrupted by `SIGINT`.
 */
export class CancelledError extends Error {
    readonly exitCode = 130;

    constructor() {
        super('Cancelled.');
        this.name = 'CancelledError';
    }
}

/**
 * Prints an error of a command as a single line, without its stack trace unless `verbose` is enabled, and sets the exit code of the process.
 * @param error The error thrown by the command.
 * @param verbose Whether to print the stack trace of the error.
 */
export function handleCliError(error: unknown, verbose = false): void {
    if (error instanceof CancelledError) {
        console.error(chalk.yellow(error.message));
        process.exitCode = error.exitCode;
        return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`✗ ${message}`));
    if (verbose && error instanceof Error && error.stack) console.error(chalk.gray(error.stack));
    process.exitCode = 1;
}
