import { DomainEvent } from './domain-event';
import { Entity } from './entity';
import { HasDomainEvents } from './has-domain-events';
import { Identifier } from './identifier';

/**
 * Entity base that buffers domain events raised by an aggregate.
 * Events remain in memory until pulled or cleared; this class does not publish them.
 */
export abstract class AggregateRoot<T extends Identifier> extends Entity<T> implements HasDomainEvents {
    private readonly _domainEvents: DomainEvent[] = [];

    /**
     * Adds a domain event to the aggregate root's list of domain events. This method allows the aggregate root to track events that have occurred within its context, which can be used for event sourcing or other domain-driven design patterns.
     * @param event The domain event to be added to the aggregate root's list of domain events.
     */
    public addDomainEvent(event: DomainEvent): void {
        this._domainEvents.push(event);
    }

    /**
     * Pulls all domain events from the aggregate root and clears the list of domain events. This method allows the aggregate root to retrieve its domain events and reset its state.
     * @returns An array of domain events that were associated with the aggregate root.
     */
    public pullDomainEvents(): DomainEvent[] {
        const events = [...this._domainEvents];
        this.clearDomainEvents();
        return events;
    }

    /**
     * Clears all domain events from the aggregate root. This method allows the aggregate root to reset its state.
     */
    public clearDomainEvents(): void {
        this._domainEvents.length = 0;
    }
}
