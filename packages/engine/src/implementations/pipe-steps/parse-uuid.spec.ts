import { PipeStepParsingError } from '../../pipe';
import { ParseUuid, ParseUuidPipeStep } from './parse-uuid';

describe('ParseUuidPipeStep', () => {
    const step = new ParseUuidPipeStep();
    const v4 = '9b2f8f4e-3c1a-4d7e-9a6b-2f1c3d4e5f60';
    const v7 = '01890a5d-ac96-774b-bcce-b302099a8057';

    it('should return the step and its configuration', () => {
        expect(ParseUuid()).toStrictEqual({ pipeStep: ParseUuidPipeStep, PipeStepConfig: { version: undefined } });
        expect(ParseUuid(7)).toStrictEqual({ pipeStep: ParseUuidPipeStep, PipeStepConfig: { version: 7 } });
    });

    it.each([v4, v7, '6ba7b810-9dad-11d1-80b4-00c04fd430c8', '00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff'])(
        'should accept %s',
        (value) => {
            expect(step.execute({ value } as any)).toBe(value);
        }
    );

    it('should return the UUID in lower case', () => {
        expect(step.execute({ value: v4.toUpperCase() } as any)).toBe(v4);
    });

    it('should check the version', () => {
        expect(step.execute({ value: v7 } as any, { version: 7 })).toBe(v7);
        expect(() => step.execute({ value: v4 } as any, { version: 7 })).toThrow('is not a valid UUID v7');
        expect(() => step.execute({ value: '00000000-0000-0000-0000-000000000000' } as any, { version: 4 })).toThrow(PipeStepParsingError);
    });

    it.each(['', 'abc', '9b2f8f4e3c1a4d7e9a6b2f1c3d4e5f60', '9b2f8f4e-3c1a-0d7e-9a6b-2f1c3d4e5f60', '9b2f8f4e-3c1a-4d7e-7a6b-2f1c3d4e5f60', undefined, 1])(
        'should throw for %p',
        (value) => {
            expect(() => step.execute({ parameter: 'path', value } as any)).toThrow(PipeStepParsingError);
        }
    );
});
