const addCommand = jest.fn();
const name = jest.fn().mockReturnThis();
const description = jest.fn().mockReturnThis();
const option = jest.fn().mockReturnThis();
const opts = jest.fn().mockReturnValue({});
const parseAsync = jest.fn();

const CommandMock = jest.fn(() => ({
    name,
    description,
    option,
    opts,
    addCommand,
    parseAsync
}));

const createCommand = { name: 'create' };
const handleCliError = jest.fn();

jest.mock('commander', () => ({
    Command: CommandMock
}));

jest.mock('./commands/create', () => ({
    createCommand
}));

jest.mock('./errors', () => ({
    handleCliError
}));

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('CLI', () => {
    const debug = process.env.DEBUG;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        delete process.env.DEBUG;
        parseAsync.mockResolvedValue(undefined);
    });

    afterAll(() => {
        if (debug === undefined) delete process.env.DEBUG;
        else process.env.DEBUG = debug;
    });

    it('debería configurar correctamente el programa y ejecutar parseAsync', async () => {
        await import('./index');

        expect(CommandMock).toHaveBeenCalledTimes(1);

        expect(name).toHaveBeenCalledWith('axispark');
        expect(description).toHaveBeenCalledWith('CLI for AxiSpark.js');
        expect(option).toHaveBeenCalledWith('--verbose', 'print the stack trace of the errors');
        expect(addCommand).toHaveBeenCalledWith(createCommand);
        expect(parseAsync).toHaveBeenCalledTimes(1);
        expect(handleCliError).not.toHaveBeenCalled();
    });

    it('should handle the errors of the commands without the stack trace by default', async () => {
        const error = new Error('Invalid project name');
        parseAsync.mockRejectedValue(error);

        await import('./index');
        await flush();

        expect(handleCliError).toHaveBeenCalledWith(error, false);
    });

    it.each([
        ['--verbose', { verbose: true }, undefined],
        ['DEBUG', {}, '1']
    ])('should print the stack trace with %s', async (_, options, debugValue) => {
        opts.mockReturnValue(options);
        if (debugValue) process.env.DEBUG = debugValue;
        const error = new Error('boom');
        parseAsync.mockRejectedValue(error);

        await import('./index');
        await flush();

        expect(handleCliError).toHaveBeenCalledWith(error, true);
    });
});
