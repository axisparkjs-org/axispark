import { FileUploadDefinition } from './file-upload-definition';

describe('FileUploadDefinition', () => {
    it('allows every MIME type when no list is configured', () => {
        const definition = new FileUploadDefinition(1024, 1);

        expect(definition.isMimeTypeAllowed('image/png')).toBe(true);
    });

    it('only allows the configured MIME types ignoring case', () => {
        const definition = new FileUploadDefinition(1024, 1, ['application/pdf']);

        expect(definition.isMimeTypeAllowed('Application/PDF')).toBe(true);
        expect(definition.isMimeTypeAllowed('image/png')).toBe(false);
    });
});
