import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';
import { directoryExists, updatePackageJson } from '../utils/filesystem';
import { installDependencies } from '../utils/package-manager';
import { downloadTemplate } from '../utils/template';

export const createCommand = new Command('create')
    .description('Create a new framework project')
    .argument('[name]', 'project name')
    .option('-t, --template <template>', 'template to use')
    .option('-i, --install', 'install dependencies after creating the project')
    .option('--no-install', 'do not install dependencies after creating the project')
    .action(async (name: string, options: Record<string, any>) => {
        // 1. Ask for the project name if it was not provided
        if (!name) {
            const response = await prompts({
                type: 'text',
                name: 'name',
                message: 'What is your project name?'
            });
            name = response.name;
        }

        validateProjectName(name as string);
        const projectPath = path.resolve(process.cwd(), name as string);

        // 2. Check that the directory does not exist
        if (await directoryExists(projectPath)) {
            console.log(chalk.red(`✗ Directory "${name}" already exists.`));
            process.exit(1);
        }

        // 3. Copy the template
        const spinner = ora('Creating project...').start();
        if (!options.template) {
            const response = await prompts({
                type: 'select',
                name: 'template',
                message: 'Select a template:',
                choices: [
                    { title: 'Basic', value: 'default' },
                    { title: 'HTTP', value: 'http' },
                    { title: 'HTTP + Security', value: 'http-security' },
                    { title: 'Scheduler', value: 'scheduler' },
                    { title: 'HTTP + OpenAPI', value: 'http-openapi' }
                ],
                initial: 0
            });
            options.template = response.template;
        }

        try {
            await downloadTemplate(options.template as string, name as string);
            await updatePackageJson(projectPath, name as string);
            spinner.succeed(chalk.green('Project created'));
        } catch (error) {
            spinner.fail(chalk.red('Failed to create project'));
            throw error;
        }

        // 4. Ask whether to install dependencies
        if (options.install === undefined) {
            const response = await prompts({
                type: 'confirm',
                name: 'install',
                message: 'Install dependencies?',
                initial: true
            });
            options.install = response.install;
        }

        if (options.install) {
            const spinner = ora('Installing dependencies...').start();
            try {
                await installDependencies(projectPath);
                spinner.succeed(chalk.green('Dependencies installed'));
            } catch (error) {
                spinner.fail(chalk.red('Failed to install dependencies'));
                throw error;
            }
        }

        // 5. Show the result
        console.log();
        console.log(chalk.green('✓ Project ready!'));
        console.log();
        console.log(chalk.gray('Next steps:'));
        console.log();
        console.log(`  cd ${name}`);
        console.log(`  npm run dev`);
        console.log();
    });

function validateProjectName(name: string) {
    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
        throw new Error('Invalid project name');
    }
}
