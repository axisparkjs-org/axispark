import { PipeStep, PipeStepConfig, PipeStepParsingError } from '../../pipe';
import { Injectable } from '@axisparkjs/di';
import { ParameterDefinition } from '../../parameter';

/** The UUID versions defined by RFC 9562. */
export type UuidVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ParseUuidPipeStepConfig extends PipeStepConfig {
    version?: UuidVersion;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([1-8])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NIL = '00000000-0000-0000-0000-000000000000';
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

@Injectable()
export class ParseUuidPipeStep implements PipeStep<string, string> {
    execute(parameter: ParameterDefinition, config?: ParseUuidPipeStepConfig): any {
        const value = parameter.value;
        const version = config?.version;
        const type = version === undefined ? 'UUID' : `UUID v${version}`;

        if (typeof value === 'string') {
            const uuid = value.toLowerCase();
            const match = UUID.exec(uuid);
            if (match && (version === undefined || Number(match[1]) === version)) return uuid;
            if (version === undefined && (uuid === NIL || uuid === MAX)) return uuid;
        }

        throw new PipeStepParsingError(parameter, `Value '${value}' is not a valid ${type} (expected the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).`, type);
    }
}

/**
 * A decorator for applying the `ParseUuidPipeStep` to a method parameter. It checks that the parameter is a UUID (RFC 9562, versions 1 to 8, and the nil and max UUIDs when no version is given) and returns it in lower case. If the value is not a UUID, or not of the given version, a `PipeStepParsingError` is thrown.
 *
 * ```typescript
 * find(@Path('id') @Pipe(ParseUuid()) id: string) {}
 * ```
 * @param version Optional version that the UUID must have, such as `4` or `7`.
 * @returns A pipe decorator that applies the `ParseUuidPipeStep`.
 */
export const ParseUuid = (version?: UuidVersion) => {
    return {
        pipeStep: ParseUuidPipeStep,
        PipeStepConfig: { version } as ParseUuidPipeStepConfig
    };
};
