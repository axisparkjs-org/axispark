import { DomainEvent } from './domain-event';

/** Contract for objects that expose and clear their pending domain events. */
export interface HasDomainEvents {
    /**
     * Pulls all domain events from the implementing class and clears the list of domain events. This method allows the implementing class to retrieve its domain events and reset its state.
     * @returns An array of domain events that were associated with the implementing class.
     */
    pullDomainEvents(): DomainEvent[];
}
