import { CancelledError, handleCliError } from './errors';

describe('CLI errors', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        process.exitCode = undefined;
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        process.exitCode = undefined;
    });

    it('should describe a cancellation', () => {
        const error = new CancelledError();

        expect(error.message).toBe('Cancelled.');
        expect(error.name).toBe('CancelledError');
        expect(error.exitCode).toBe(130);
    });

    it('should print a cancellation and exit with the code 130', () => {
        handleCliError(new CancelledError());

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cancelled.'));
        expect(process.exitCode).toBe(130);
    });

    it('should print the message of an error without its stack trace and exit with the code 1', () => {
        handleCliError(new Error('Invalid project name'));

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✗ Invalid project name'));
        expect(process.exitCode).toBe(1);
    });

    it('should print the stack trace in verbose mode', () => {
        const error = new Error('boom');

        handleCliError(error, true);

        expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
        expect(consoleErrorSpy).toHaveBeenLastCalledWith(expect.stringContaining(error.stack as string));
    });

    it('should print a value that is not an error', () => {
        handleCliError('failed', true);

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✗ failed'));
        expect(process.exitCode).toBe(1);
    });
});
