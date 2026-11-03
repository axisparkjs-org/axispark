import { readdirSync } from 'node:fs';
import path from 'node:path';

import { TEMPLATES, validateTemplate } from './templates';

describe('templates', () => {
    it('lists every template of the repository', () => {
        const directories = readdirSync(path.join(__dirname, '..', '..', '..', 'templates'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();

        expect(TEMPLATES.map(({ value }) => value).sort()).toEqual(directories);
    });

    it.each(TEMPLATES.map(({ value }) => value))('accepts the %s template', (template) => {
        expect(() => validateTemplate(template)).not.toThrow();
    });

    it('rejects unknown templates and lists the available ones', () => {
        expect(() => validateTemplate('htpp')).toThrow('Unknown template "htpp". Available templates: default, http, http-security, scheduler, http-openapi.');
    });
});
