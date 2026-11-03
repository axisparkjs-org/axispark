import { TransactionManager } from './transaction-manager';
import { Transactional } from './transactional';

describe('Transactional', () => {
    const runInTransaction = jest.fn(async (callback: () => unknown) => callback());
    const transactionManager = { runInTransaction } as unknown as TransactionManager;

    beforeEach(() => {
        jest.clearAllMocks();
        TransactionManager.setActive(transactionManager);
    });

    afterEach(() => {
        TransactionManager.clearActive(transactionManager);
    });

    class OrderService {
        constructor(private readonly prefix: string) {}

        @Transactional()
        async placeOrder(id: number): Promise<string> {
            return `${this.prefix}-${id}`;
        }

        @Transactional({ dataSource: 'REPORTING', isolationLevel: 'SERIALIZABLE' })
        async report(): Promise<void> {
            throw new Error('report failed');
        }
    }

    it('runs the method through the active transaction manager, keeping its instance and arguments', async () => {
        const service = new OrderService('order');

        await expect(service.placeOrder(1)).resolves.toBe('order-1');

        expect(runInTransaction).toHaveBeenCalledWith(expect.any(Function), {});
    });

    it('passes the decorator options and propagates errors', async () => {
        await expect(new OrderService('order').report()).rejects.toThrow('report failed');

        expect(runInTransaction).toHaveBeenCalledWith(expect.any(Function), { dataSource: 'REPORTING', isolationLevel: 'SERIALIZABLE' });
    });

    it('keeps the name of the decorated method', () => {
        expect(OrderService.prototype.placeOrder.name).toBe('placeOrder');
    });

    it('rejects when the DataPlugin is not registered', async () => {
        TransactionManager.clearActive(transactionManager);

        await expect(new OrderService('order').placeOrder(1)).rejects.toThrow('No TransactionManager is available');
        expect(runInTransaction).not.toHaveBeenCalled();
    });

    it('can only decorate methods', () => {
        const decorate = () => Transactional()({}, 'value', { value: 42 });

        expect(decorate).toThrow("@Transactional can only decorate methods, 'value' is not a method.");
    });
});
