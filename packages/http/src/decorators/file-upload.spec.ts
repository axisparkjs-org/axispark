import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { FileUpload } from './file-upload';

describe('FileUpload decorator', () => {
    class TestController {
        handle() {}
    }

    it('stores file upload options on a class', () => {
        FileUpload({ maxFiles: 2 })(TestController);

        expect(Metadata.get(MetadataKeys.FILE_UPLOAD, TestController)).toEqual(expect.objectContaining({ target: TestController, options: { maxFiles: 2 } }));
    });

    it('stores partial file upload options on a method', () => {
        FileUpload({ allowedMimeTypes: ['application/pdf'] })(
            TestController.prototype,
            'handle',
            Object.getOwnPropertyDescriptor(TestController.prototype, 'handle') as PropertyDescriptor
        );

        expect(Metadata.get(MetadataKeys.FILE_UPLOAD, TestController, 'handle')).toEqual(
            expect.objectContaining({ target: TestController, propertyKey: 'handle', options: { allowedMimeTypes: ['application/pdf'] } })
        );
    });

    it('stores empty options by default', () => {
        class DefaultController {}
        FileUpload()(DefaultController);

        expect(Metadata.get(MetadataKeys.FILE_UPLOAD, DefaultController)).toEqual(expect.objectContaining({ options: {} }));
    });
});
