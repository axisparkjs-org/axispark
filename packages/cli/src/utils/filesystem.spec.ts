import { access, readFile, rm, writeFile } from 'node:fs/promises';

import { directoryExists, removeDirectory, updatePackageJson } from './filesystem';

jest.mock('node:fs/promises', () => ({
    access: jest.fn(),
    cp: jest.fn(),
    readFile: jest.fn(),
    rm: jest.fn(),
    writeFile: jest.fn()
}));

jest.mock('node:path', () => ({
    resolve: jest.fn(),
    join: jest.fn()
}));

import path from 'node:path';

const mockedAccess = access as jest.MockedFunction<typeof access>;
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedPathJoin = path.join as jest.MockedFunction<typeof path.join>;

describe('filesystem utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('directoryExists', () => {
        it('returns true when the directory exists', async () => {
            mockedAccess.mockResolvedValue(undefined);

            const result = await directoryExists('/projects/my-project');

            expect(result).toBe(true);
            expect(mockedAccess).toHaveBeenCalledWith('/projects/my-project');
        });

        it('returns false when the directory does not exist', async () => {
            mockedAccess.mockRejectedValue(new Error('ENOENT'));

            const result = await directoryExists('/projects/my-project');

            expect(result).toBe(false);
            expect(mockedAccess).toHaveBeenCalledWith('/projects/my-project');
        });

        it('returns false for any access error', async () => {
            mockedAccess.mockRejectedValue(new Error('Permission denied'));

            const result = await directoryExists('/projects/my-project');

            expect(result).toBe(false);
        });
    });

    describe('removeDirectory', () => {
        it('removes the directory recursively and ignores missing directories', async () => {
            (rm as jest.MockedFunction<typeof rm>).mockResolvedValue(undefined);

            await removeDirectory('/projects/my-project');

            expect(rm).toHaveBeenCalledWith('/projects/my-project', { recursive: true, force: true });
        });

        it('propagates errors when the directory cannot be removed', async () => {
            (rm as jest.MockedFunction<typeof rm>).mockRejectedValue(new Error('EBUSY'));

            await expect(removeDirectory('/projects/my-project')).rejects.toThrow('EBUSY');
        });
    });

    describe('updatePackageJson', () => {
        it('reads package.json from the project directory', async () => {
            mockedPathJoin.mockReturnValue('/projects/my-project/package.json');

            mockedReadFile.mockResolvedValue(
                JSON.stringify({
                    name: 'old-name',
                    version: '1.0.0'
                })
            );

            await updatePackageJson('/projects/my-project', 'my-project');

            expect(mockedPathJoin).toHaveBeenCalledWith('/projects/my-project', 'package.json');

            expect(mockedReadFile).toHaveBeenCalledWith('/projects/my-project/package.json', 'utf8');
        });

        it('reads the own package.json to get the current package version', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project'
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.3.4'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            expect(mockedReadFile).toHaveBeenNthCalledWith(1, '/projects/my-project/package.json', 'utf8');
            expect(mockedReadFile).toHaveBeenNthCalledWith(2, '/own/package.json', 'utf8');
        });

        it('updates the package name', async () => {
            mockedPathJoin.mockReturnValue('/projects/my-project/package.json');

            mockedReadFile.mockResolvedValue(
                JSON.stringify({
                    name: 'old-name',
                    version: '1.0.0',
                    description: 'My project'
                })
            );

            await updatePackageJson('/projects/my-project', 'new-project');

            expect(mockedWriteFile).toHaveBeenCalledWith('/projects/my-project/package.json', expect.stringContaining('"name": "new-project"'));
        });

        it('updates @axisparkjs dependencies to the own package version', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        dependencies: {
                            '@axisparkjs/core': '^1.0.0',
                            '@axisparkjs/utils': '~1.2.0',
                            lodash: '^4.17.21'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.3.4'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson.dependencies).toEqual({
                '@axisparkjs/core': '2.3.4',
                '@axisparkjs/utils': '2.3.4',
                lodash: '^4.17.21'
            });
        });

        it('updates @axisparkjs devDependencies to the own package version', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        devDependencies: {
                            '@axisparkjs/eslint-config': '^1.0.0',
                            typescript: '^5.0.0'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '3.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson.devDependencies).toEqual({
                '@axisparkjs/eslint-config': '3.0.0',
                typescript: '^5.0.0'
            });
        });

        it('updates @axisparkjs dependencies in both dependencies and devDependencies', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        dependencies: {
                            '@axisparkjs/core': '^1.0.0',
                            react: '^18.0.0'
                        },
                        devDependencies: {
                            '@axisparkjs/testing': '^1.0.0',
                            jest: '^29.0.0'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '4.5.6'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson).toEqual({
                name: 'my-project',
                dependencies: {
                    '@axisparkjs/core': '4.5.6',
                    react: '^18.0.0'
                },
                devDependencies: {
                    '@axisparkjs/testing': '4.5.6',
                    jest: '^29.0.0'
                }
            });
        });

        it('does not modify non-@axisparkjs dependencies', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        dependencies: {
                            lodash: '^4.17.21',
                            react: '^18.2.0'
                        },
                        devDependencies: {
                            typescript: '^5.0.0',
                            jest: '^29.0.0'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson.dependencies).toEqual({
                lodash: '^4.17.21',
                react: '^18.2.0'
            });

            expect(packageJson.devDependencies).toEqual({
                typescript: '^5.0.0',
                jest: '^29.0.0'
            });
        });

        it('does not update dependency names that only contain @axisparkjs in the middle', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        dependencies: {
                            'foo-@axisparkjs/bar': '^1.0.0',
                            '@other/axisparkjs-package': '^2.0.0'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson.dependencies).toEqual({
                'foo-@axisparkjs/bar': '^1.0.0',
                '@other/axisparkjs-package': '^2.0.0'
            });
        });

        it('does nothing when dependencies are missing', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project'
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson).toEqual({
                name: 'my-project'
            });
        });

        it('does nothing when devDependencies are missing', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        dependencies: {
                            lodash: '^4.17.21'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson).toEqual({
                name: 'my-project',
                dependencies: {
                    lodash: '^4.17.21'
                }
            });
        });

        it('uses the exact own package version without preserving the dependency range', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project',
                        dependencies: {
                            '@axisparkjs/core': '^1.0.0'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '5.0.0-beta.2'
                    })
                );

            await updatePackageJson('/projects/my-project', 'my-project');

            const [, content] = mockedWriteFile.mock.calls[0];
            const packageJson = JSON.parse(content as string);

            expect(packageJson.dependencies['@axisparkjs/core']).toBe('5.0.0-beta.2');
        });

        it('preserves the other package.json properties', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'old-name',
                        version: '1.0.0',
                        description: 'My project',
                        scripts: {
                            dev: 'node index.js'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'new-project');

            const [, content] = mockedWriteFile.mock.calls[0];

            const packageJson = JSON.parse(content as string);

            expect(packageJson).toEqual({
                name: 'new-project',
                version: '1.0.0',
                description: 'My project',
                scripts: {
                    dev: 'node index.js'
                }
            });
        });

        it('writes formatted JSON with a trailing newline', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'old-name',
                        version: '1.0.0',
                        dependencies: {
                            '@axisparkjs/core': '^1.0.0'
                        },
                        devDependencies: {
                            '@axisparkjs/eslint-config': '^1.0.0'
                        }
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            await updatePackageJson('/projects/my-project', 'new-project');

            expect(mockedWriteFile).toHaveBeenCalledWith(
                '/projects/my-project/package.json',
                '{\n    "name": "new-project",\n    "version": "1.0.0",\n    "dependencies": {\n        "@axisparkjs/core": "2.0.0"\n    },\n    "devDependencies": {\n        "@axisparkjs/eslint-config": "2.0.0"\n    }\n}\n'
            );
        });

        it('propagates errors when reading package.json fails', async () => {
            mockedPathJoin.mockReturnValue('/projects/my-project/package.json');

            mockedReadFile.mockRejectedValue(new Error('Unable to read package.json'));

            await expect(updatePackageJson('/projects/my-project', 'my-project')).rejects.toThrow('Unable to read package.json');

            expect(mockedWriteFile).not.toHaveBeenCalled();
        });

        it('propagates errors when reading the own package.json fails', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project'
                    })
                )
                .mockRejectedValueOnce(new Error('Unable to read own package.json'));

            await expect(updatePackageJson('/projects/my-project', 'my-project')).rejects.toThrow('Unable to read own package.json');

            expect(mockedWriteFile).not.toHaveBeenCalled();
        });

        it('propagates errors when writing package.json fails', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'old-name'
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: '@axisparkjs/cli',
                        version: '2.0.0'
                    })
                );

            mockedWriteFile.mockRejectedValue(new Error('Unable to write package.json'));

            await expect(updatePackageJson('/projects/my-project', 'my-project')).rejects.toThrow('Unable to write package.json');
        });

        it('throws when package.json contains invalid JSON', async () => {
            mockedPathJoin.mockReturnValue('/projects/my-project/package.json');

            mockedReadFile.mockResolvedValue('{ invalid json }');

            await expect(updatePackageJson('/projects/my-project', 'my-project')).rejects.toThrow();

            expect(mockedWriteFile).not.toHaveBeenCalled();
        });

        it('throws when the own package.json contains invalid JSON', async () => {
            mockedPathJoin.mockReturnValueOnce('/projects/my-project/package.json').mockReturnValueOnce('/own/package.json');

            mockedReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({
                        name: 'my-project'
                    })
                )
                .mockResolvedValueOnce('{ invalid json }');

            await expect(updatePackageJson('/projects/my-project', 'my-project')).rejects.toThrow();

            expect(mockedWriteFile).not.toHaveBeenCalled();
        });
    });
});
