import { RateLimit } from '@axisparkjs/engine';
import { Controller, Get, NotFoundError, Path } from '@axisparkjs/http';
import { Logger } from '@axisparkjs/logger';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('observability-sample');

@Controller('orders')
export class OrderController {
    constructor(private readonly logger: Logger) {}

    /** Produces the span `GET /api/orders/:id`, a child span for the query, and a log entry with the trace_id and span_id of the request. */
    @Get(':id')
    async find(@Path('id') id: string) {
        if (id === 'missing') throw new NotFoundError(`Order ${id} not found`);

        const order = await tracer.startActiveSpan('load order', async (span) => {
            span.setAttribute('order.id', id);
            span.end();
            return { id, total: 42 };
        });
        await this.logger.info(`Order ${id} loaded`);
        return order;
    }

    /** An unhandled error: a 500 response and a span with the error status. */
    @Get('broken/now')
    broken() {
        throw new Error('The order service is broken');
    }

    /** Two requests every 10 seconds: the rejections increase axispark.rate_limit.rejections. */
    @Get('limited/now')
    @RateLimit({ ttl: 10_000, limit: 2 })
    limited() {
        return { ok: true };
    }
}
