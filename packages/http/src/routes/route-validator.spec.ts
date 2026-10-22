import { RouteValidator } from './route-validator';
import { RouteDefinition } from './route-definition';
import { HttpMethod } from '../types';
import { HttpPluginOptions } from '../plugin/http-plugin-options';

describe('RouteValidator', () => {
    class UsersController {}
    class AdminController {}

    const logger = { warn: jest.fn().mockResolvedValue(undefined) };
    const createValidator = (options: Partial<HttpPluginOptions> = {}) => new RouteValidator(options as HttpPluginOptions, logger as any);

    const route = (path: string, target: any = UsersController, versions: string[] = [], hosts: string[] = ['*'], method = HttpMethod.Get) =>
        new RouteDefinition(target, 'handler', method, path, versions, hosts, jest.fn());

    const group = (...candidates: RouteDefinition[]) => {
        const [first] = candidates;
        return new RouteDefinition(first.target, first.propertyKey, first.httpMethod, first.path, first.versions, first.hosts, jest.fn(), candidates);
    };

    beforeEach(() => {
        logger.warn.mockClear();
    });

    it('warns about every conflict by default', async () => {
        const routes = [route('/users/:id'), route('/users/:slug'), route('/users/me'), route('/files/*'), route('/files/report')];

        await createValidator().validate(routes);

        expect(logger.warn).toHaveBeenCalledTimes(4);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('UsersController.handler'));
    });

    it('does nothing when route validation is disabled', async () => {
        await createValidator({ routeValidation: false, routeValidationOptions: { onDuplicate: 'error' } }).validate([route('/users'), route('/users')]);

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('ignores configured conflict types', async () => {
        await createValidator({ routeValidationOptions: { onUnreachable: 'ignore' } }).validate([route('/users/*'), route('/users/:name', AdminController)]);

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('throws all configured errors together without logging them as warnings', async () => {
        const routes = [route('/users/:id'), route('/users/:slug'), route('/users/me')];
        const validator = createValidator({ routeValidationOptions: { onDuplicate: 'error', onAmbiguous: 'error' } });

        await expect(validator.validate(routes)).rejects.toThrow(/3 conflict\(s\):[\s\S]*duplicate:[\s\S]*ambiguous:/);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('validates the routes grouped inside a dispatch route', async () => {
        const dispatch = group(route('/users', UsersController, ['1'], ['*']), route('/users', AdminController, ['1'], ['*']));

        await createValidator().validate([dispatch]);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('duplicate'));
    });

    it('does not report same-path routes that differ by host', async () => {
        const dispatch = group(route('/users', UsersController, [], ['admin.example.com']), route('/users', AdminController, [], ['api.example.com']));

        await createValidator({ routeValidationOptions: { onDuplicate: 'error' } }).validate([dispatch]);

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not report same-path routes that differ by version', async () => {
        const dispatch = group(route('/users', UsersController, ['1']), route('/users', AdminController, ['2']));

        await createValidator({ routeValidationOptions: { onDuplicate: 'error' } }).validate([dispatch]);

        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('reports same-path routes when a wildcard host or version overlaps', async () => {
        const hostDispatch = group(route('/a', UsersController, [], ['*']), route('/a', AdminController, [], ['admin.example.com']));
        const versionDispatch = group(route('/b', UsersController, ['*']), route('/b', AdminController, ['2']));

        await createValidator().validate([hostDispatch, versionDispatch]);

        expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('describes the host and versions of the conflicting routes', async () => {
        await createValidator().validate([route('/users', UsersController, ['1'], ['admin.example.com']), route('/users', AdminController, ['1', '2'], ['*'])]);

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('UsersController.handler, hosts: admin.example.com, versions: 1'));
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('AdminController.handler, hosts: *, versions: 1, 2'));
    });
});
