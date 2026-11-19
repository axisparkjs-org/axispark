import { mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import * as tar from 'tar';

const REPOSITORY = 'axisparkjs-org/axispark';

export async function downloadTemplate(template: string, destination: string): Promise<void> {
    const tempDirectory = await createTempDirectory();
    let templatePath: string;

    try {
        if (process.env.NODE_ENV !== 'test') {
            const archivePath = path.join(tempDirectory, 'templates.tar.gz');

            const url = `https://github.com/${REPOSITORY}` + `/archive/refs/heads/main.tar.gz`;

            const response = await fetch(url);

            if (!response.ok || !response.body) {
                throw new Error(`Failed to download templates: ${response.status}`);
            }

            await pipeline(Readable.fromWeb(response.body as any), (await import('node:fs')).createWriteStream(archivePath));

            const extractDirectory = path.join(tempDirectory, 'extracted');
            await mkdir(extractDirectory);

            await tar.x({
                file: archivePath,
                cwd: extractDirectory
            });

            templatePath = path.join(extractDirectory, 'axispark-main', 'templates', template);
        } else {
            templatePath = path.join(__dirname, '..', '..', '..', '..', 'templates', template);
        }

        await cp(templatePath, destination, {
            recursive: true
        });
    } finally {
        await rm(tempDirectory, {
            recursive: true,
            force: true
        });
    }
}

async function createTempDirectory() {
    return await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), 'axispark-')));
}
