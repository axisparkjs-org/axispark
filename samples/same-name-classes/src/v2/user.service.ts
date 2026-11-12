import { Injectable } from '@axisparkjs/di';

@Injectable()
export class UserService {
    readonly version = 'v2';

    getUser(id: string) {
        return { id, firstName: 'Ada', lastName: 'Lovelace' };
    }
}
