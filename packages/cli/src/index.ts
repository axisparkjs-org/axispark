#!/usr/bin/env node

import { Command } from 'commander';
import { createCommand } from './commands/create';
import { handleCliError } from './errors';

const program = new Command();

program.name('axispark').description('CLI for AxiSpark.js').option('--verbose', 'print the stack trace of the errors');

program.addCommand(createCommand);
program.parseAsync().catch((error: unknown) => handleCliError(error, Boolean(program.opts().verbose || process.env.DEBUG)));
