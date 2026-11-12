import { Injectable } from '@axisparkjs/di';

@Injectable()
export class UserService {
    readonly version = 'v1';

    getUser(id: string) {
        return { id, name: 'Ada' };
    }
}
