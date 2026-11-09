#!/usr/bin/env node
// Adds the release that `changeset version` has just applied to the root CHANGELOG.md.
//
// All the packages are released together (fixed group), so instead of one changelog per package with
// the same entries repeated, the repository keeps a single CHANGELOG.md with a section per version.
// The section is built from the changesets that `changeset version` consumed: they are deleted from the
// working tree but still exist in HEAD, so this script must run after `changeset version` and before
// the release commit.
//
// The bump of each changeset decides its group: major -> Breaking changes, minor -> Features,
// patch -> Improvements and fixes.
//
// Usage: node scripts/release-notes.mjs [--notes <file>]
//   --notes <file>  also writes the new section (without its heading) to <file>, used as the body of
//                   the GitHub release.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const changelogPath = resolve(root, 'CHANGELOG.md');

const HEADER = `# Changelog

All the \`@axisparkjs/*\` packages are released together and share the same version. This file lists
the changes of each release; it is generated from the changesets when a version is released (see
\`scripts/release-notes.mjs\`).
`;

const GROUPS = [
    { bump: 'major', title: 'Breaking changes' },
    { bump: 'minor', title: 'Features' },
    { bump: 'patch', title: 'Improvements and fixes' }
];
const BUMP_ORDER = GROUPS.map((group) => group.bump);

function git(...args) {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function parseChangeset(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return undefined;

    const bumps = [...match[1].matchAll(/:\s*["']?(major|minor|patch)["']?\s*$/gm)].map((m) => m[1]);
    const summary = match[2].trim();
    if (!bumps.length || !summary) return undefined;

    // A changeset that affects several packages with different bumps is grouped by the highest one.
    const bump = BUMP_ORDER.find((level) => bumps.includes(level));
    return { bump, summary };
}

function toListItem(summary) {
    const [first, ...rest] = summary.split(/\r?\n/);
    return [`- ${first}`, ...rest.map((line) => (line.trim() ? `  ${line}` : ''))].join('\n');
}

const notesIndex = process.argv.indexOf('--notes');
const notesPath = notesIndex === -1 ? undefined : process.argv[notesIndex + 1];

const version = JSON.parse(readFileSync(resolve(root, 'packages/core/package.json'), 'utf8')).version;
const date = new Date().toISOString().slice(0, 10);

const consumed = git('diff', '--name-only', '--diff-filter=D', 'HEAD', '--', '.changeset/*.md')
    .split('\n')
    .filter((file) => file && !file.endsWith('README.md'));

const changes = consumed.map((file) => parseChangeset(git('show', `HEAD:${file}`))).filter(Boolean);

if (!changes.length) {
    console.log(`No changesets were consumed for ${version}, CHANGELOG.md is not updated`);
    process.exit(0);
}

const body = GROUPS.map(({ bump, title }) => {
    const items = changes.filter((change) => change.bump === bump);
    return items.length ? `### ${title}\n\n${items.map((change) => toListItem(change.summary)).join('\n')}\n` : '';
})
    .filter(Boolean)
    .join('\n');

const current = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : HEADER;

if (new RegExp(`^## ${version.replace(/\./g, '\\.')} `, 'm').test(current)) {
    console.error(`CHANGELOG.md already has a section for ${version}`);
    process.exit(1);
}

// The new section goes before the first release, after the header.
const firstRelease = current.search(/^## /m);
const head = (firstRelease === -1 ? current : current.slice(0, firstRelease)).trimEnd();
const tail = firstRelease === -1 ? '' : current.slice(firstRelease);

writeFileSync(changelogPath, `${head}\n\n## ${version} (${date})\n\n${body}\n${tail}`.trimEnd() + '\n');
if (notesPath) writeFileSync(notesPath, body);

console.log(`CHANGELOG.md updated with ${changes.length} changes for ${version}`);
