import path from 'node:path';

import { createCommand } from './create';

import prompts from 'prompts';
import ora from 'ora';

import { directoryExists, updatePackageJson } from '../utils/filesystem';

import { installDependencies } from '../utils/package-manager';
import { downloadTemplate } from '../utils/template';

jest.mock('prompts', () => ({
    __esModule: true,
    default: jest.fn()
}));

jest.mock('ora', () => ({
    __esModule: true,
    default: jest.fn()
}));

jest.mock('../utils/filesystem', () => ({
    directoryExists: jest.fn(),
    copyTemplate: jest.fn(),
    updatePackageJson: jest.fn()
}));

jest.mock('../utils/package-manager', () => ({
    installDependencies: jest.fn()
}));

jest.mock('../utils/template', () => ({
    downloadTemplate: jest.fn()
}));

const mockedPrompts = prompts as jest.MockedFunction<typeof prompts>;
const mockedOra = ora as jest.MockedFunction<typeof ora>;

const mockedDirectoryExists = directoryExists as jest.MockedFunction<typeof directoryExists>;

const mockedUpdatePackageJson = updatePackageJson as jest.MockedFunction<typeof updatePackageJson>;

const mockedInstallDependencies = installDependencies as jest.MockedFunction<typeof installDependencies>;

const mockedDownloadTemplate = downloadTemplate as jest.MockedFunction<typeof downloadTemplate>;

describe('create command', () => {
    let spinner: {
        start: jest.Mock;
        succeed: jest.Mock;
        fail: jest.Mock;
    };

    let consoleLogSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        spinner = {
            start: jest.fn().mockReturnThis(),
            succeed: jest.fn(),
            fail: jest.fn()
        };

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        mockedOra.mockReturnValue(spinner as any);

        mockedDirectoryExists.mockResolvedValue(false);
        mockedUpdatePackageJson.mockResolvedValue(undefined);
        mockedDownloadTemplate.mockResolvedValue(undefined);
        mockedInstallDependencies.mockResolvedValue(undefined);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        processExitSpy?.mockRestore();
    });

    async function runCommand(
        name?: string,
        options: {
            template?: string;
            install?: boolean;
            noInstall?: boolean;
        } = {}
    ) {
        const args = [
            'node',
            'test',
            ...(name ? [name] : []),
            ...(options.template ? ['--template', options.template] : []),
            ...(options.install ? ['--install'] : []),
            ...(options.noInstall ? ['--no-install'] : [])
        ];

        await createCommand.parseAsync(args);
    }

    describe('command definition', () => {
        it('has the expected command name', () => {
            expect(createCommand.name()).toBe('create');
        });

        it('has the expected description', () => {
            expect(createCommand.description()).toBe('Create a new framework project');
        });
    });

    describe('project name', () => {
        it('uses the provided project name', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('default', 'my-project');
        });

        it('asks for the project name when it is not provided', async () => {
            mockedPrompts
                .mockResolvedValueOnce({
                    name: 'my-project'
                })
                .mockResolvedValueOnce({
                    template: 'default'
                })
                .mockResolvedValueOnce({
                    install: false
                });

            await runCommand();

            expect(mockedPrompts).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    type: 'text',
                    name: 'name',
                    message: 'What is your project name?'
                })
            );

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('default', 'my-project');
        });

        it.each(['my.project', 'my/project', 'my project', 'my@project', 'my$project', 'my#project', 'my!project', 'my project!', 'my.project-name'])(
            'rejects invalid project name "%s"',
            async (name) => {
                await expect(runCommand(name)).rejects.toThrow('Invalid project name');

                expect(mockedDirectoryExists).not.toHaveBeenCalled();
                expect(mockedDownloadTemplate).not.toHaveBeenCalled();
                expect(mockedUpdatePackageJson).not.toHaveBeenCalled();
            }
        );

        it.each(['my-project', 'my_project', 'myProject', 'myproject', 'my123', '123-project', '123', 'MY_PROJECT', 'a', 'a-b', 'a_b'])(
            'accepts valid project name "%s"',
            async (name) => {
                mockedPrompts
                    .mockResolvedValueOnce({
                        template: 'default'
                    })
                    .mockResolvedValueOnce({
                        install: false
                    });

                await expect(runCommand(name)).resolves.toBeUndefined();

                expect(mockedDownloadTemplate).toHaveBeenCalledWith('default', name);
            }
        );
    });

    describe('existing directory', () => {
        it('exits when the project directory already exists', async () => {
            mockedDirectoryExists.mockResolvedValue(true);

            processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
                throw new Error('process.exit');
            }) as never);

            await expect(runCommand('existing-project')).rejects.toThrow('process.exit');

            expect(mockedDirectoryExists).toHaveBeenCalledWith(path.resolve(process.cwd(), 'existing-project'));

            expect(mockedDownloadTemplate).not.toHaveBeenCalled();
            expect(mockedUpdatePackageJson).not.toHaveBeenCalled();
            expect(mockedInstallDependencies).not.toHaveBeenCalled();

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Directory "existing-project" already exists.'));

            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('checks the resolved project path', async () => {
            const projectName = 'my-project';
            const projectPath = path.resolve(process.cwd(), projectName);

            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand(projectName, {
                template: 'default'
            });

            expect(mockedDirectoryExists).toHaveBeenCalledWith(projectPath);
        });
    });

    describe('template selection', () => {
        it('uses the template passed through --template', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'http'
            });

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');

            expect(mockedPrompts).toHaveBeenCalledTimes(1);
        });

        it('asks for a template when none is provided', async () => {
            mockedPrompts
                .mockResolvedValueOnce({
                    template: 'http'
                })
                .mockResolvedValueOnce({
                    install: false
                });

            await runCommand('my-project');

            expect(mockedPrompts).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    type: 'select',
                    name: 'template',
                    message: 'Select a template:'
                })
            );

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');
        });

        it('provides the expected template choices', async () => {
            mockedPrompts
                .mockResolvedValueOnce({
                    template: 'default'
                })
                .mockResolvedValueOnce({
                    install: false
                });

            await runCommand('my-project');

            expect(mockedPrompts).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    choices: [
                        {
                            title: 'Basic',
                            value: 'default'
                        },
                        {
                            title: 'HTTP',
                            value: 'http'
                        },
                        {
                            title: 'HTTP + Security',
                            value: 'http-security'
                        },
                        {
                            title: 'Scheduler',
                            value: 'scheduler'
                        },
                        {
                            title: 'HTTP + OpenAPI',
                            value: 'http-openapi'
                        }
                    ],
                    initial: 0
                })
            );
        });

        it('uses the first template as the initial selection', async () => {
            mockedPrompts
                .mockResolvedValueOnce({
                    template: 'default'
                })
                .mockResolvedValueOnce({
                    install: false
                });

            await runCommand('my-project');

            expect(mockedPrompts).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    initial: 0
                })
            );
        });
    });

    describe('project creation', () => {
        it.each(['http-security', 'scheduler', 'http-openapi'])('downloads the %s template selected with --template', async (template) => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', { template });

            expect(mockedDownloadTemplate).toHaveBeenCalledWith(template, 'my-project');
        });

        it('downloads the selected template', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'http'
            });

            expect(mockedDownloadTemplate).toHaveBeenCalledTimes(1);
            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');
        });

        it('updates package.json with the project name', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            const projectPath = path.resolve(process.cwd(), 'my-project');

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedUpdatePackageJson).toHaveBeenCalledWith(projectPath, 'my-project');
        });

        it('executes creation steps in the expected order', async () => {
            const calls: string[] = [];

            mockedDownloadTemplate.mockImplementation(async () => {
                calls.push('download');
            });

            mockedUpdatePackageJson.mockImplementation(async () => {
                calls.push('update');
            });

            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(calls).toEqual(['download', 'update']);
        });

        it('starts the creation spinner', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedOra).toHaveBeenCalledWith('Creating project...');

            expect(spinner.start).toHaveBeenCalledTimes(1);
        });

        it('marks the creation spinner as successful', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(spinner.succeed).toHaveBeenCalledWith(expect.stringContaining('Project created'));
        });
    });

    describe('project creation errors', () => {
        it('handles template download errors', async () => {
            const error = new Error('Download failed');

            mockedDownloadTemplate.mockRejectedValueOnce(error);

            await expect(
                runCommand('my-project', {
                    template: 'default'
                })
            ).rejects.toThrow('Download failed');

            expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining('Failed to create project'));

            expect(mockedUpdatePackageJson).not.toHaveBeenCalled();
        });

        it('handles package.json update errors', async () => {
            const error = new Error('Package update failed');

            mockedUpdatePackageJson.mockRejectedValueOnce(error);

            await expect(
                runCommand('my-project', {
                    template: 'default'
                })
            ).rejects.toThrow('Package update failed');

            expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining('Failed to create project'));

            expect(mockedInstallDependencies).not.toHaveBeenCalled();
        });

        it('does not install dependencies when project creation fails', async () => {
            mockedDownloadTemplate.mockRejectedValueOnce(new Error('Download failed'));

            await expect(
                runCommand('my-project', {
                    template: 'default'
                })
            ).rejects.toThrow('Download failed');

            expect(mockedInstallDependencies).not.toHaveBeenCalled();
        });
    });

    describe('dependency installation', () => {
        it('asks whether dependencies should be installed by default', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedPrompts).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'confirm',
                    name: 'install',
                    message: 'Install dependencies?',
                    initial: true
                })
            );
        });

        it('installs dependencies when the user confirms', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedInstallDependencies).toHaveBeenCalledTimes(1);
            expect(mockedInstallDependencies).toHaveBeenCalledWith(path.resolve(process.cwd(), 'my-project'));
        });

        it('does not install dependencies when the user declines', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedInstallDependencies).not.toHaveBeenCalled();
        });

        it('starts the installation spinner when dependencies are installed', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(mockedOra).toHaveBeenCalledWith('Installing dependencies...');
        });

        it('marks the installation spinner as successful', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(spinner.succeed).toHaveBeenCalledWith(expect.stringContaining('Dependencies installed'));
        });

        it('handles dependency installation errors', async () => {
            const error = new Error('npm install failed');

            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            mockedInstallDependencies.mockRejectedValueOnce(error);

            await expect(
                runCommand('my-project', {
                    template: 'default'
                })
            ).rejects.toThrow('npm install failed');

            expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining('Failed to install dependencies'));
        });

        it('keeps the created project when installation fails', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            mockedInstallDependencies.mockRejectedValueOnce(new Error('npm install failed'));

            await expect(
                runCommand('my-project', {
                    template: 'default'
                })
            ).rejects.toThrow('npm install failed');

            expect(mockedDownloadTemplate).toHaveBeenCalled();
            expect(mockedUpdatePackageJson).toHaveBeenCalled();
            expect(mockedInstallDependencies).toHaveBeenCalled();
        });
    });

    describe('installation options', () => {
        it('installs dependencies with --install', async () => {
            await runCommand('my-project', {
                template: 'default',
                install: true
            });

            expect(mockedInstallDependencies).toHaveBeenCalledWith(path.resolve(process.cwd(), 'my-project'));

            expect(mockedPrompts).not.toHaveBeenCalled();
        });

        it('does not install dependencies with --no-install', async () => {
            await runCommand('my-project', {
                template: 'default',
                noInstall: true
            });

            expect(mockedInstallDependencies).not.toHaveBeenCalled();
            expect(mockedPrompts).not.toHaveBeenCalled();
        });

        it('does not ask for installation when --install is used', async () => {
            await runCommand('my-project', {
                template: 'default',
                install: true
            });

            expect(mockedPrompts).not.toHaveBeenCalled();
        });

        it('does not ask for installation when --no-install is used', async () => {
            await runCommand('my-project', {
                template: 'default',
                noInstall: true
            });

            expect(mockedPrompts).not.toHaveBeenCalled();
        });

        it('supports --template together with --install', async () => {
            await runCommand('my-project', {
                template: 'http',
                install: true
            });

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');

            expect(mockedInstallDependencies).toHaveBeenCalledWith(path.resolve(process.cwd(), 'my-project'));
        });

        it('supports --template together with --no-install', async () => {
            await runCommand('my-project', {
                template: 'http',
                noInstall: true
            });

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');

            expect(mockedInstallDependencies).not.toHaveBeenCalled();
        });
    });

    describe('output', () => {
        it('prints the project ready message', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Project ready!'));
        });

        it('prints the next steps message', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
        });

        it('prints the cd command with the project name', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(consoleLogSpy).toHaveBeenCalledWith('  cd my-project');
        });

        it('prints the development command', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(consoleLogSpy).toHaveBeenCalledWith('  npm run dev');
        });

        it('prints the final output after successful installation', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            await runCommand('my-project', {
                template: 'default'
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Project ready!'));

            expect(consoleLogSpy).toHaveBeenCalledWith('  cd my-project');

            expect(consoleLogSpy).toHaveBeenCalledWith('  npm run dev');
        });

        it('does not print project ready when creation fails', async () => {
            mockedDownloadTemplate.mockRejectedValueOnce(new Error('Download failed'));

            await expect(
                runCommand('my-project', {
                    template: 'default'
                })
            ).rejects.toThrow('Download failed');

            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Project ready!'));
        });
    });

    describe('complete flow', () => {
        it('creates a project without installing dependencies', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: false
            } as any);

            const projectPath = path.resolve(process.cwd(), 'my-project');

            await runCommand('my-project', {
                template: 'http'
            });

            expect(mockedDirectoryExists).toHaveBeenCalledWith(projectPath);

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');

            expect(mockedUpdatePackageJson).toHaveBeenCalledWith(projectPath, 'my-project');

            expect(mockedInstallDependencies).not.toHaveBeenCalled();

            expect(mockedPrompts).toHaveBeenCalledTimes(1);
        });

        it('creates a project and installs dependencies', async () => {
            mockedPrompts.mockResolvedValueOnce({
                install: true
            } as any);

            const projectPath = path.resolve(process.cwd(), 'my-project');

            await runCommand('my-project', {
                template: 'http'
            });

            expect(mockedDirectoryExists).toHaveBeenCalledWith(projectPath);

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'my-project');

            expect(mockedUpdatePackageJson).toHaveBeenCalledWith(projectPath, 'my-project');

            expect(mockedInstallDependencies).toHaveBeenCalledWith(projectPath);

            expect(mockedPrompts).toHaveBeenCalledTimes(1);
        });

        it('creates a project using interactive name, template and installation', async () => {
            mockedPrompts
                .mockResolvedValueOnce({
                    name: 'interactive-project'
                })
                .mockResolvedValueOnce({
                    template: 'http'
                })
                .mockResolvedValueOnce({
                    install: true
                });

            await runCommand();

            const projectPath = path.resolve(process.cwd(), 'interactive-project');

            expect(mockedDirectoryExists).toHaveBeenCalledWith(projectPath);

            expect(mockedDownloadTemplate).toHaveBeenCalledWith('http', 'interactive-project');

            expect(mockedUpdatePackageJson).toHaveBeenCalledWith(projectPath, 'interactive-project');

            expect(mockedInstallDependencies).toHaveBeenCalledWith(projectPath);

            expect(mockedPrompts).toHaveBeenCalledTimes(3);
        });
    });
});
