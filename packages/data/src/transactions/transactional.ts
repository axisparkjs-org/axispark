import { TransactionManager } from './transaction-manager';
import { TransactionOptions } from './transaction-options';

/**
 * Runs the decorated method inside a database transaction, through
 * {@link TransactionManager.runInTransaction}. Every repository call made by the
 * method, including derived query methods, joins the transaction.
 *
 * The decorated method always returns a `Promise`. If it throws or rejects, the
 * transaction is rolled back and the error is rethrown; otherwise the transaction
 * is committed when the method resolves. A transactional method called from
 * another one on the same data source joins the outer transaction.
 *
 * It can be used in any class, whether it is resolved through the dependency
 * injection container or not, once the `DataPlugin` is registered.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class OrderService {
 *     constructor(
 *         private readonly orders: OrderRepository,
 *         private readonly stock: StockRepository
 *     ) {}
 *
 *     @Transactional()
 *     async placeOrder(order: Order): Promise<Order> {
 *         await this.stock.reserve(order.items);
 *         return this.orders.save(order);
 *     }
 * }
 * ```
 *
 * @param options Data source and isolation level of the transaction.
 * @returns A method decorator.
 */
export function Transactional(options: TransactionOptions = {}): MethodDecorator {
    return (_target, propertyKey, descriptor: PropertyDescriptor) => {
        const original = descriptor.value;
        if (typeof original !== 'function') {
            throw new Error(`@Transactional can only decorate methods, '${String(propertyKey)}' is not a method.`);
        }

        const transactional = async function (this: unknown, ...args: unknown[]) {
            return TransactionManager.getActive().runInTransaction(() => original.apply(this, args), options);
        };
        Object.defineProperty(transactional, 'name', { value: original.name, configurable: true });
        descriptor.value = transactional;
    };
}
