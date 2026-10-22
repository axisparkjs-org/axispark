import { Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { HttpContext } from '../types';
import { HostDefinition } from './host-definition';

/** Resolves the request host and stores it in the host definition. */
@Injectable()
export class HostProcessor implements Processable {
    process(host: HostDefinition | undefined, context: Pick<HttpContext, 'request'>): void {
        if (!host) return;

        host.setHost(context.request.headers?.host ?? context.request.getHeader?.('host'));
    }
}
