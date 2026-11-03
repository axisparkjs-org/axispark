/** Official project templates that `axispark create` can generate, in the order shown by the prompt. */
export const TEMPLATES = [
    { title: 'Basic', value: 'default' },
    { title: 'HTTP', value: 'http' },
    { title: 'HTTP + Security', value: 'http-security' },
    { title: 'Scheduler', value: 'scheduler' },
    { title: 'HTTP + OpenAPI', value: 'http-openapi' }
] as const;

/** Throws when `template` is not one of the official templates, listing the available ones. */
export function validateTemplate(template: string): void {
    if (!TEMPLATES.some(({ value }) => value === template)) {
        throw new Error(`Unknown template "${template}". Available templates: ${TEMPLATES.map(({ value }) => value).join(', ')}.`);
    }
}
