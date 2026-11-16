import { ClassRegistry } from '@axisparkjs/di';
import { ClassIdentifier } from './class-identifier';

const createClass = (name: string) => ({ [name]: class {} })[name];

describe('ClassIdentifier', () => {
    it('uses the name of a registered class that does not share its name', () => {
        const Target = createClass('UniqueRegisteredController');
        ClassRegistry.register(Target);

        expect(ClassIdentifier.of(Target)).toBe('UniqueRegisteredController');
        ClassRegistry.remove(Target);
    });

    it('gives registered classes with the same name different identifiers by registration order', () => {
        const First = createClass('SharedNameController');
        const Second = createClass('SharedNameController');
        const Third = createClass('SharedNameController');
        ClassRegistry.register(First);
        ClassRegistry.register(Second);
        ClassRegistry.register(Third);

        expect(ClassIdentifier.of(Third)).toBe('SharedNameController#3');
        expect(ClassIdentifier.of(First)).toBe('SharedNameController');
        expect(ClassIdentifier.of(Second)).toBe('SharedNameController#2');
        [First, Second, Third].forEach((target) => ClassRegistry.remove(target));
    });

    it('always returns the same identifier for a class', () => {
        const Target = createClass('StableController');
        const id = ClassIdentifier.of(Target);

        expect(ClassIdentifier.of(Target)).toBe(id);
    });

    it('gives unregistered classes with the same name different identifiers', () => {
        const First = createClass('UnregisteredController');
        const Second = createClass('UnregisteredController');

        expect(ClassIdentifier.of(First)).toBe('UnregisteredController');
        expect(ClassIdentifier.of(Second)).toBe('UnregisteredController~2');
    });

    it('never gives an unregistered class the name of a registered class', () => {
        const Registered = createClass('MixedController');
        const Unregistered = createClass('MixedController');
        ClassRegistry.register(Registered);

        expect(ClassIdentifier.of(Unregistered)).toBe('MixedController~1');
        expect(ClassIdentifier.of(Registered)).toBe('MixedController');
        ClassRegistry.remove(Registered);
    });
});
