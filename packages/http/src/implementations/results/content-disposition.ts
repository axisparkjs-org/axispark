/**
 * The type of a `Content-Disposition` header: `attachment` downloads the content, and `inline` shows it in the browser when it can.
 */
export type ContentDispositionType = 'attachment' | 'inline';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS_AND_SEPARATORS = /[\u0000-\u001f\u007f/\\]/g;
const NON_ASCII = /[^\u0020-\u007e]/g;
const HAS_NON_ASCII = /[^\u0020-\u007e]/;
const QUOTED_STRING_SPECIALS = /["\\]/g;
const NOT_ATTR_CHAR = /['()*]/g;

/**
 * Builds the value of a `Content-Disposition` header with a file name, as described by RFC 6266.
 *
 * - The control characters (such as `\r` and `\n`) and the path separators (`/` and `\`) are removed from the name, so a name taken from user data can not produce an invalid header or a path.
 * - `filename` has an ASCII fallback of the name: the characters outside ASCII are replaced with `?`, and `"` is escaped with a backslash.
 * - `filename*` has the name encoded in UTF-8 and percent-encoded (RFC 8187), and is only added when the name is not plain ASCII.
 *
 * @param filename The name of the file.
 * @param type The type of the disposition. Defaults to `attachment`.
 * @returns The value of the header, for example `attachment; filename="a?o.txt"; filename*=UTF-8''a%C3%B1o.txt`.
 * @example contentDisposition('report.pdf'); // attachment; filename="report.pdf"
 */
export function contentDisposition(filename: string, type: ContentDispositionType = 'attachment'): string {
    const name = filename.replace(CONTROL_CHARACTERS_AND_SEPARATORS, '');
    if (!name) return type;

    const fallback = name.replace(NON_ASCII, '?').replace(QUOTED_STRING_SPECIALS, (char) => `\\${char}`);
    let header = `${type}; filename="${fallback}"`;

    if (HAS_NON_ASCII.test(name)) {
        const encoded = encodeURIComponent(name).replace(NOT_ATTR_CHAR, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
        header += `; filename*=UTF-8''${encoded}`;
    }

    return header;
}
