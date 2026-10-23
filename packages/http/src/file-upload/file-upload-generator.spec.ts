import { ExecutionContext } from '@axisparkjs/engine';
import { FileUpload } from '../decorators/file-upload';
import { HttpPluginOptions } from '../plugin/http-plugin-options';
import { DEFAULT_MAX_FILE_SIZE, DEFAULT_MAX_FILES, FileUploadGenerator } from './file-upload-generator';

describe('FileUploadGenerator', () => {
    const message = jest.fn();

    class PlainController {
        handle() {}
    }

    @FileUpload({ maxFiles: 2, allowedMimeTypes: ['image/png'] })
    class DecoratedController {
        inherited() {}

        @FileUpload({ maxFileSize: 10, allowedMimeTypes: ['Application/PDF'] })
        overridden() {}
    }

    const context = (target: object, propertyKey: string) => ({ target, propertyKey }) as unknown as ExecutionContext;
    const generator = (options: Partial<HttpPluginOptions> = {}) => new FileUploadGenerator(options as HttpPluginOptions);

    it('uses the built-in defaults when nothing is configured', () => {
        const definition = generator().generate(context(PlainController, 'handle'));

        expect(definition.maxFileSize).toBe(DEFAULT_MAX_FILE_SIZE);
        expect(definition.maxFiles).toBe(DEFAULT_MAX_FILES);
        expect(definition.allowedMimeTypes).toBeUndefined();
        expect(definition.message).toBeUndefined();
    });

    it('uses the global options when there are no decorators', () => {
        const definition = generator({ fileUploadOptions: { maxFileSize: 100, maxFiles: 3, allowedMimeTypes: ['text/plain'], message } }).generate(
            context(PlainController, 'handle')
        );

        expect(definition).toEqual(expect.objectContaining({ maxFileSize: 100, maxFiles: 3, allowedMimeTypes: ['text/plain'], message }));
    });

    it('merges controller options over global options', () => {
        const definition = generator({ fileUploadOptions: { maxFileSize: 100, maxFiles: 5, message } }).generate(context(DecoratedController, 'inherited'));

        expect(definition).toEqual(expect.objectContaining({ maxFileSize: 100, maxFiles: 2, allowedMimeTypes: ['image/png'], message }));
    });

    it('merges handler options over controller and global options', () => {
        const definition = generator({ fileUploadOptions: { maxFileSize: 100, maxFiles: 5 } }).generate(context(DecoratedController, 'overridden'));

        expect(definition).toEqual(expect.objectContaining({ maxFileSize: 10, maxFiles: 2, allowedMimeTypes: ['application/pdf'] }));
    });
});
