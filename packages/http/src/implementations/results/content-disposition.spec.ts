import { contentDisposition } from './content-disposition';

describe('contentDisposition', () => {
    it('should quote a plain ASCII name', () => {
        expect(contentDisposition('report.pdf')).toBe('attachment; filename="report.pdf"');
    });

    it('should use the given type', () => {
        expect(contentDisposition('report.pdf', 'inline')).toBe('inline; filename="report.pdf"');
    });

    it('should escape the double quotes of the name', () => {
        expect(contentDisposition('the "best" report.pdf')).toBe('attachment; filename="the \\"best\\" report.pdf"');
    });

    it('should add an ASCII fallback and an UTF-8 name for a name with accents', () => {
        expect(contentDisposition('informe "año".txt')).toBe('attachment; filename="informe \\"a?o\\".txt"; filename*=UTF-8\'\'informe%20%22a%C3%B1o%22.txt');
    });

    it('should add an UTF-8 name for a name outside Latin-1', () => {
        expect(contentDisposition('報告.txt')).toBe('attachment; filename="??.txt"; filename*=UTF-8\'\'%E5%A0%B1%E5%91%8A.txt');
        expect(contentDisposition('€ 😀.txt')).toBe('attachment; filename="? ??.txt"; filename*=UTF-8\'\'%E2%82%AC%20%F0%9F%98%80.txt');
    });

    it('should percent-encode the characters that are not allowed in an extended value', () => {
        expect(contentDisposition("l'été (1)*.txt")).toBe("attachment; filename=\"l'?t? (1)*.txt\"; filename*=UTF-8''l%27%C3%A9t%C3%A9%20%281%29%2A.txt");
    });

    it('should remove the control characters and the path separators', () => {
        expect(contentDisposition('../etc/pass\r\nwd\\x.txt')).toBe('attachment; filename="..etcpasswdx.txt"');
        expect(contentDisposition('a\u0000b\u007fc.txt')).toBe('attachment; filename="abc.txt"');
    });

    it('should give the same result when it is called several times', () => {
        expect(contentDisposition('año.txt')).toBe(contentDisposition('año.txt'));
        expect(contentDisposition('plain.txt')).toBe('attachment; filename="plain.txt"');
    });

    it('should send only the type when nothing is left of the name', () => {
        expect(contentDisposition('/\r\n')).toBe('attachment');
    });

    it('should always produce a header value that Node.js accepts', () => {
        const { validateHeaderValue } = jest.requireActual<typeof import('node:http')>('node:http');
        for (const name of ['informe "año".txt', '報告.txt', 'a\r\nSet-Cookie: x=1', '😀', 'back\\slash.txt']) {
            expect(() => validateHeaderValue('Content-Disposition', contentDisposition(name))).not.toThrow();
        }
    });
});
