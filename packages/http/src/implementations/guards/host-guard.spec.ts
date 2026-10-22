import { HttpContext } from '../../types';
import { HostDefinition } from '../../host';
import { NotFoundError } from '../errors';
import { HostGuard } from './host-guard';

describe('HostGuard', () => {
    const guard = new HostGuard();
    const definitionFor = (acceptedHosts: string[] = []) => {
        const definition = new HostDefinition();
        definition.setAcceptedHosts(acceptedHosts);
        return definition;
    };

    const createContext = (host?: HostDefinition): HttpContext =>
        ({
            host,
            request: { method: 'GET', path: '/users' }
        }) as unknown as HttpContext;

    it('accepts requests without a host restriction', async () => {
        await expect(guard.failedCheckHost(createContext())).resolves.toBeUndefined();
    });

    it('accepts the host stored in the context definition', async () => {
        const host = definitionFor(['admin.example.com']);
        host.setHost('ADMIN.EXAMPLE.COM:3000');

        await expect(guard.failedCheckHost(createContext(host))).resolves.toBeUndefined();
    });

    it('rejects a host that does not match the context definition', async () => {
        const host = definitionFor(['admin.example.com']);
        host.setHost('api.example.com');

        await expect(guard.failedCheckHost(createContext(host))).rejects.toBeInstanceOf(NotFoundError);
        await expect(guard.failedCheckHost(createContext(host))).rejects.toThrow('Route not found for GET /users');
    });

    it('rejects when the context has no request host', async () => {
        const host = definitionFor(['admin.example.com']);

        await expect(guard.failedCheckHost(createContext(host))).rejects.toBeInstanceOf(NotFoundError);
    });
});
