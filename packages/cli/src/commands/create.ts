import { Command } from 'commander';
import prompts, { PromptObject } from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import { TEMPLATES, validateTemplate } from '../templates';
import { directoryExists, removeDirectory, updatePackageJson } from '../utils/filesystem';
import { installDependencies } from '../utils/package-manager';
import { downloadTemplate } from '../utils/template';
import { CancelledError } from '../errors';

export const createCommand = new Command('create')
    .description('Create a new framework project')
    .argument('[name]', 'project name')
    .option('-t, --template <template>', 'template to use')
    .option('-i, --install', 'install dependencies after creating the project')
    .option('--no-install', 'do not install dependencies after creating the project')
    .action(async (name: string, options: Record<string, any>) => {
        // 1. Ask for the project name if it was not provided
        if (!name) {
            name = await ask<string>({
                type: 'text',
                name: 'name',
                message: 'What is your project name?',
                validate: (value: string) => isValidProjectName(value) || PROJECT_NAME_RULE
            });
        }

        validateProjectName(name);
        if (options.template) validateTemplate(options.template as string);
        const projectPath = path.resolve(process.cwd(), name as string);

        // 2. Check that the directory does not exist
        if (await directoryExists(projectPath)) {
            console.log(chalk.red(`✗ Directory "${name}" already exists.`));
            process.exit(1);
        }

        // 3. Copy the template
        if (!options.template) {
            options.template = await ask<string>({
                type: 'select',
                name: 'template',
                message: 'Select a template:',
                choices: TEMPLATES.map(({ title, value }) => ({ title, value })),
                initial: 0
            });
            validateTemplate(options.template as string);
        }

        const spinner = ora('Creating project...').start();
        try {
            await downloadTemplate(options.template as string, name as string);
            await updatePackageJson(projectPath, name as string);
            spinner.succeed(chalk.green('Project created'));
        } catch (error) {
            spinner.fail(chalk.red('Failed to create project'));
            // The directory did not exist before, so everything in it was written by this command.
            await removeDirectory(projectPath).catch(() => {
                console.log(chalk.yellow(`! Could not remove the directory "${name}". Delete it before running the command again.`));
            });
            throw error;
        }

        // 4. Ask whether to install dependencies
        // The project already exists at this point, so cancelling this prompt means "do not install".
        let installCancelled = false;
        if (options.install === undefined) {
            try {
                options.install = await ask<boolean>({
                    type: 'confirm',
                    name: 'install',
                    message: 'Install dependencies?',
                    initial: true
                });
            } catch (error) {
                if (!(error instanceof CancelledError)) throw error;
                installCancelled = true;
                options.install = false;
            }
        }

        if (options.install) {
            const spinner = ora('Installing dependencies...').start();
            try {
                await installDependencies(projectPath);
                spinner.succeed(chalk.green('Dependencies installed'));
            } catch (error) {
                spinner.fail(chalk.red('Failed to install dependencies'));
                console.log(chalk.yellow(`! The project was created. Run "npm install" in "${name}" to install the dependencies.`));
                throw error;
            }
        }

        if (installCancelled) console.log(chalk.yellow('! Dependencies not installed.'));

        // 5. Show the result
        console.log();
        console.log(chalk.green('✓ Project ready!'));
        console.log();
        console.log(chalk.gray('Next steps:'));
        console.log();
        console.log(`  cd ${name}`);
        if (!options.install) console.log(`  npm install`);
        console.log(`  npm run dev`);
        console.log();
    });

const PROJECT_NAME_RULE = 'Use only letters, numbers, "-" and "_".';

function isValidProjectName(name: unknown): name is string {
    return typeof name === 'string' && /^[a-zA-Z0-9-_]+$/.test(name);
}

function validateProjectName(name: unknown): asserts name is string {
    if (!isValidProjectName(name)) {
        throw new Error(`Invalid project name "${String(name ?? '')}". ${PROJECT_NAME_RULE}`);
    }
}

/**
 * Asks a single question, and stops the command when the user cancels it.
 * @param question The question to ask.
 * @returns The answer of the user.
 * @throws {CancelledError} If the user cancels the prompt (Ctrl+C or Esc).
 */
async function ask<T>(question: PromptObject<string> & { name: string }): Promise<T> {
    let cancelled = false;
    const response = await prompts(question, {
        onCancel: () => {
            cancelled = true;
            return false;
        }
    });
    const answer = response[question.name] as T | undefined;
    if (cancelled || answer === undefined) throw new CancelledError();
    return answer;
}
