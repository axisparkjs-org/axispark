import { PipeStep, PipeStepConfig, PipeStepParsingError } from '../../pipe';
import { Injectable } from '@axisparkjs/di';
import { ParameterDefinition } from '../../parameter';

export interface ParseDatePipeStepOptions {
    /** Accept only dates without time (`YYYY-MM-DD`). Defaults to `false`. */
    dateOnly?: boolean;
}

export interface ParseDatePipeStepConfig extends PipeStepConfig, ParseDatePipeStepOptions {}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))$/i;

@Injectable()
export class ParseDatePipeStep implements PipeStep<string, Date> {
    execute(parameter: ParameterDefinition, config?: ParseDatePipeStepConfig): any {
        const value = parameter.value;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

        const date = typeof value === 'string' ? this.parse(value.trim(), config?.dateOnly ?? false) : undefined;
        if (date) return date;

        const expected = config?.dateOnly ? 'YYYY-MM-DD' : 'YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss with Z or an offset';
        throw new PipeStepParsingError(parameter, `Value '${value}' is not a valid ISO 8601 date (expected ${expected}).`, 'date');
    }

    private parse(value: string, dateOnly: boolean): Date | undefined {
        const dateMatch = DATE.exec(value);
        if (dateMatch) {
            return isValidDate(dateMatch) ? new Date(`${value}T00:00:00Z`) : undefined;
        }

        if (dateOnly) return undefined;

        const match = DATE_TIME.exec(value);
        if (!match || !isValidDate(match)) return undefined;

        const [hours, minutes, seconds, offsetHours, offsetMinutes] = [match[4], match[5], match[6] ?? '0', match[7] ?? '0', match[8] ?? '0'].map(Number);
        if (hours > 23 || minutes > 59 || seconds > 59 || offsetHours > 23 || offsetMinutes > 59) return undefined;

        return new Date(value);
    }
}

function isValidDate(match: RegExpExecArray): boolean {
    const [year, month, day] = [match[1], match[2], match[3]].map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * A decorator for applying the `ParseDatePipeStep` to a method parameter. It converts an ISO 8601 string to a `Date`: a date (`2026-03-01`, read as midnight UTC) or a date-time with `Z` or an offset (`2026-03-01T10:30:00Z`, `2026-03-01T10:30:00+02:00`). Date-times without an offset are rejected, so they are never read as local time. Invalid dates such as `2026-02-30` are rejected. With `{ dateOnly: true }`, only `YYYY-MM-DD` is accepted. If the value is not valid, a `PipeStepParsingError` is thrown.
 *
 * ```typescript
 * list(@Query('from') @Pipe(Optional(), ParseDate()) from: Date | undefined) {}
 * ```
 * @param options Optional settings: `dateOnly` accepts only dates without time.
 * @returns A pipe decorator that applies the `ParseDatePipeStep`.
 */
export const ParseDate = (options?: ParseDatePipeStepOptions) => {
    return {
        pipeStep: ParseDatePipeStep,
        PipeStepConfig: { dateOnly: options?.dateOnly } as ParseDatePipeStepConfig
    };
};
