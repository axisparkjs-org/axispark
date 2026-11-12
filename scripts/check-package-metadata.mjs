// Checks that every published package declares the npm metadata: the links to the repository, the website and
// the issues (needed by npm to generate the provenance), the keywords and the public entry points.
//
// Usage: node scripts/check-package-metadata.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPOSITORY_URL = 'git+https://github.com/axisparkjs-org/axispark.git';
const HOMEPAGE = 'https://axisparkjs.com';
const BUGS = 'https://github.com/axisparkjs-org/axispark/issues';
const PACKAGES_DIRECTORY = 'packages';

const errors = [];

for (const directory of readdirSync(PACKAGES_DIRECTORY).sort()) {
    const file = path.join(PACKAGES_DIRECTORY, directory, 'package.json');
    if (!existsSync(file)) continue;

    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const fail = (message) => errors.push(`${file}: ${message}`);

    if (pkg.repository?.type !== 'git') fail('"repository.type" must be "git"');
    if (pkg.repository?.url !== REPOSITORY_URL) fail(`"repository.url" must be "${REPOSITORY_URL}"`);
    if (pkg.repository?.directory !== `${PACKAGES_DIRECTORY}/${directory}`) fail(`"repository.directory" must be "${PACKAGES_DIRECTORY}/${directory}"`);
    if (pkg.homepage !== HOMEPAGE) fail(`"homepage" must be "${HOMEPAGE}"`);
    if (pkg.bugs !== BUGS) fail(`"bugs" must be "${BUGS}"`);
    if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes('axispark') || pkg.keywords.length < 2) {
        fail('"keywords" must include "axispark" and at least one keyword of the domain of the package');
    }
    if (pkg.description !== `AxiSpark.js - The Ultimate Node.js Framework - ${pkg.name}`) fail('"description" must end with the package name');
    if (pkg.files?.includes('tsconfig.build.json')) fail('"files" must not include "tsconfig.build.json"');

    // Libraries declare their entry point; the CLI only publishes a binary.
    if (pkg.main) {
        const entry = pkg.exports?.['.'];
        if (entry?.types !== `./${pkg.types}` || entry?.default !== `./${pkg.main}`) {
            fail(`"exports['.']" must be { "types": "./${pkg.types}", "default": "./${pkg.main}" }`);
        }
        if (pkg.exports?.['./package.json'] !== './package.json') fail('"exports" must expose "./package.json"');
    }
}

if (errors.length > 0) {
    console.error(errors.join('\n'));
    console.error(`\n${errors.length} problem(s) found in the package metadata.`);
    process.exit(1);
}

console.log('The metadata of every package is complete.');
