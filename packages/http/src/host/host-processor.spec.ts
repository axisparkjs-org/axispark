import { HostDefinition } from './host-definition';
import { HostProcessor } from './host-processor';
import { HttpContext } from '../types';

describe('HostProcessor', () => {
    const processor = new HostProcessor();
    const definitionFor = (acceptedHosts: string[] = []) => {
        const definition = new HostDefinition();
        definition.setAcceptedHosts(acceptedHosts);
        return definition;
    };

    it('sets the request host from the headers', () => {
        const definition = definitionFor(['admin.example.com']);
        const context = { request: { headers: { host: 'admin.example.com:3000' } } } as unknown as HttpContext;

        processor.process(definition, context);

        expect(definition.host).toBe('admin.example.com');
    });

    it('uses the request header accessor when the host header is absent', () => {
        const definition = definitionFor(['admin.example.com']);
        const context = { request: { headers: {}, getHeader: jest.fn().mockReturnValue('admin.example.com') } } as unknown as HttpContext;

        processor.process(definition, context);

        expect(context.request.getHeader).toHaveBeenCalledWith('host');
        expect(definition.isHostAccepted()).toBe(true);
    });

    it('sets an undefined host when neither the header nor the accessor is available', () => {
        const definition = definitionFor(['*']);
        const context = { request: {} } as unknown as HttpContext;

        processor.process(definition, context);

        expect(definition.host).toBeUndefined();
    });

    it('does nothing when the definition is undefined', () => {
        const context = { request: { headers: { host: 'admin.example.com' } } } as unknown as HttpContext;

        expect(() => processor.process(undefined, context)).not.toThrow();
    });
});
