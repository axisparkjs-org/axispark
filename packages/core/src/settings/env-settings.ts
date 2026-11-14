import { Inject, InjectionToken } from '@axisparkjs/di';

/**
 * An injection token bound to the application settings, the deeply frozen object returned by the `load` function of the `settings` option. Without the `settings` option, it is bound to an empty object.
 *
 * ```typescript
 * @Injectable()
 * export class MailService {
 *     constructor(@Inject(AXISPARK_ENV_SETTINGS) private readonly settings: AppSettings) {}
 * }
 * ```
 */
export const AXISPARK_ENV_SETTINGS = new InjectionToken('AXISPARK_ENV_SETTINGS');

/**
 * The type of the application settings when they are injected without a type of their own. Augment it to type the injected settings in the whole application:
 *
 * ```typescript
 * declare module '@axisparkjs/core' {
 *     interface EnvSettings {
 *         port: number;
 *         databaseUrl: string;
 *     }
 * }
 * ```
 */
// An interface, instead of a record, so applications can augment it.
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export interface EnvSettings {
    readonly [key: string]: unknown;
}

/**
 * A parameter decorator that injects the application settings. It works as `@Inject(AXISPARK_ENV_SETTINGS)`.
 *
 * ```typescript
 * @Injectable()
 * export class MailService {
 *     constructor(@EnvSettings() private readonly settings: EnvSettings) {}
 * }
 * ```
 * @returns A parameter decorator.
 */
export function EnvSettings(): ParameterDecorator {
    return Inject(AXISPARK_ENV_SETTINGS);
}
