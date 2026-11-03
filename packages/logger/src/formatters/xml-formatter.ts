import { LogEntry } from '../log-entry';
import { LogFormatter } from '../log-formatter';
import { LogLevel } from '../log-level';

/**
 * A log formatter that outputs log entries in XML format.
 */
export class XmlFormatter implements LogFormatter {
    format(entry: LogEntry): string {
        const metadata = entry.metadata ? `<metadata>${this.cdata(JSON.stringify(entry.metadata))}</metadata>` : '';

        const error = entry.error
            ? `
    <error>
        <name>${this.escape(entry.error.name)}</name>
        <message>${this.escape(entry.error.message)}</message>
        <stack>${this.cdata(entry.error.stack ?? '')}</stack>
    </error>`
            : '';

        const scopes = entry.scopes.map((scope) => `<scope>${this.escape(scope)}</scope>`).join('');

        return `<log>
    <timestamp>${entry.timestamp.toISOString()}</timestamp>
    <level>${LogLevel[entry.level].toLocaleUpperCase()}</level>
    <message>${this.escape(entry.message)}</message>
    <scopes>${scopes}</scopes>
    ${metadata}
    ${error}
</log>`;
    }

    /** Wraps a value in a CDATA section, splitting any `]]>` so it cannot close the section early. */
    private cdata(value: string): string {
        return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
    }

    private escape(value: string): string {
        return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
    }
}
