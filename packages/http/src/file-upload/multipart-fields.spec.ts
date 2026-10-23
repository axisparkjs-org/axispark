import { appendMultipartField, MultipartFields } from './multipart-fields';

describe('appendMultipartField', () => {
    it('stores single values and collects repeated names into an array', () => {
        const fields: MultipartFields = {};

        appendMultipartField(fields, 'name', 'John');
        appendMultipartField(fields, 'tags', 'a');
        appendMultipartField(fields, 'tags', 'b');
        appendMultipartField(fields, 'tags', 'c');

        expect(fields).toEqual({ name: 'John', tags: ['a', 'b', 'c'] });
    });
});
