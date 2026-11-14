/**
 * Error thrown when the application settings are not valid. It is thrown once, when the application is created, and lists every invalid or missing variable.
 *
 * The values of the variables are not included in the message for the rules that can involve secrets, such as the length of a string or the format of a URL.
 *
 * ```
 * Invalid application settings:
 *   - DATABASE_URL is required
 *   - PORT must be an integer (received "30o0")
 *   - SESSION_SECRET must have at least 32 characters
 * ```
 */
export class InvalidSettingsError extends Error {
    /**
     * Creates a new instance of the `InvalidSettingsError` class.
     * @param errors The problems found while loading the settings, one per variable and rule.
     */
    constructor(public readonly errors: readonly string[]) {
        super(['Invalid application settings:', ...errors.map((error) => `  - ${error}`)].join('\n'));
        this.name = 'InvalidSettingsError';
    }
}
