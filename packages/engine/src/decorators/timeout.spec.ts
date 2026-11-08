import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Timeout, NoTimeout } from './timeout';

jest.mock('@axisparkjs/common', () => ({
    Metadata: {
        normalizeTarget: jest.fn((target) => target),
        define: jest.fn()
    },
    MetadataKeys: {
        TIMEOUT: 'TIMEOUT'
    }
}));

describe('Timeout', () => {
    describe('when used as a method decorator', () => {
        it('should define the execution timeout on the method', () => {
            const target = {
                prototype: {}
            };
            const propertyKey = 'testMethod';
            const timeout = 5000;
            const metadata = {
                target,
                propertyKey,
                time: timeout
            };

            const defineSpy = jest.spyOn(Metadata, 'define');

            Timeout(timeout)(target, propertyKey, {});

            expect(defineSpy).toHaveBeenCalledWith(MetadataKeys.TIMEOUT, metadata, target, propertyKey);

            defineSpy.mockRestore();
        });
    });

    describe('when used as a class decorator', () => {
        it('should define the execution timeout on the class', () => {
            class TestClass {}

            const timeout = 5000;
            const metadata = {
                target: TestClass,
                time: timeout
            };
            const defineSpy = jest.spyOn(Metadata, 'define');

            Timeout(timeout)(TestClass);

            expect(defineSpy).toHaveBeenCalledWith(MetadataKeys.TIMEOUT, metadata, TestClass);

            defineSpy.mockRestore();
        });
    });

    describe('when the time is not greater than 0', () => {
        it.each([0, -1, -500, Number.NaN])('should throw an error for a time of %p', (time) => {
            expect(() => Timeout(time)).toThrow(
                `Invalid timeout '${time}': the time of @Timeout() must be a number of milliseconds greater than 0. Use @NoTimeout() to disable the timeout.`
            );
        });

        it('should not define any metadata', () => {
            const defineSpy = jest.spyOn(Metadata, 'define');
            defineSpy.mockClear();

            expect(() => Timeout(0)).toThrow();
            expect(defineSpy).not.toHaveBeenCalled();

            defineSpy.mockRestore();
        });
    });
});

describe('NoTimeout', () => {
    it('should define the timeout as disabled on the method', () => {
        const target = {};
        const propertyKey = 'testMethod';
        const defineSpy = jest.spyOn(Metadata, 'define');

        const metadata = {
            target: {},
            propertyKey,
            disabled: true
        };

        NoTimeout()(target, propertyKey, {});

        expect(defineSpy).toHaveBeenCalledWith(MetadataKeys.TIMEOUT, metadata, target, propertyKey);

        defineSpy.mockRestore();
    });

    it('should define the timeout as disabled on the class', () => {
        class TestClass {}
        const defineSpy = jest.spyOn(Metadata, 'define');

        NoTimeout()(TestClass);

        expect(defineSpy).toHaveBeenCalledWith(MetadataKeys.TIMEOUT, { target: TestClass, propertyKey: undefined, disabled: true }, TestClass);

        defineSpy.mockRestore();
    });
});
