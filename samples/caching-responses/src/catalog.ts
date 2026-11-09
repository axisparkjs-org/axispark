/** The products of the sample, kept in memory, and the number of times each handler ran, shared by every instance of the process. */
export const catalog = {
    products: new Map<string, { id: string; name: Record<string, string>; price: number }>([
        ['1', { id: '1', name: { en: 'Keyboard', es: 'Teclado' }, price: 49 }],
        ['2', { id: '2', name: { en: 'Mouse', es: 'Ratón' }, price: 19 }]
    ]),
    calls: new Map<string, number>(),
    guardChecks: 0,

    count(handler: string): number {
        const calls = (this.calls.get(handler) ?? 0) + 1;
        this.calls.set(handler, calls);
        return calls;
    }
};
