/** Text fields of a multipart request. Repeated field names are collected into an array. */
export type MultipartFields = Record<string, string | string[]>;

/** Adds a text field to the multipart fields, turning repeated field names into an array. */
export function appendMultipartField(fields: MultipartFields, name: string, value: string): void {
    const current = fields[name];
    if (current === undefined) fields[name] = value;
    else if (Array.isArray(current)) current.push(value);
    else fields[name] = [current, value];
}
