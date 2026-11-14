import { Controller, Get, Path, Query } from '@axisparkjs/http';
import { Default, Optional, ParseArray, ParseDate, ParseEnum, ParseInt, ParseUuid, Pipe } from '@axisparkjs/engine';

export enum OrderStatus {
    Open = 'open',
    Shipped = 'shipped',
    Cancelled = 'cancelled'
}

@Controller('orders')
export class OrderController {
    /**
     * Every query parameter is optional: `Default()` gives a value to the missing ones and `Optional()` skips the parsing of `from`.
     */
    @Get()
    list(
        @Query('page') @Pipe(Default(1), ParseInt()) page: number,
        @Query('status') @Pipe(Default(OrderStatus.Open), ParseEnum(OrderStatus, { ignoreCase: true })) status: OrderStatus,
        @Query('from') @Pipe(Optional(), ParseDate()) from: Date | undefined,
        @Query('tags') @Pipe(Default([]), ParseArray({ maxItems: 5, unique: true })) tags: string[],
        @Query('ids') @Pipe(Default([]), ParseArray({ items: ParseInt() })) ids: number[]
    ) {
        return { page, status, from: from?.toISOString() ?? null, tags, ids };
    }

    @Get(':id')
    find(@Path('id') @Pipe(ParseUuid()) id: string) {
        return { id };
    }

    @Get('v7/:id')
    findV7(@Path('id') @Pipe(ParseUuid(7)) id: string) {
        return { id };
    }
}
