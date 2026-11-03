import { Injectable } from '@axisparkjs/di';
import { IsEmail, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export interface User {
    id: string;
    name: string;
    email: string;
}

export class SearchUsersDto {
    @IsString()
    @Length(1, 50)
    query: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class CreateUserDto {
    @IsString()
    @Length(2, 50)
    name: string;

    @IsEmail()
    email: string;
}

export class WelcomePromptDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    tone?: string;
}

@Injectable()
export class UserService {
    private readonly users: User[] = [
        { id: '1', name: 'Ada Lovelace', email: 'ada@axispark.dev' },
        { id: '2', name: 'Alan Turing', email: 'alan@axispark.dev' },
        { id: '3', name: 'Grace Hopper', email: 'grace@axispark.dev' }
    ];

    search(query: string, limit = 10): User[] {
        return this.users.filter((user) => user.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
    }

    findById(id: string): User | undefined {
        return this.users.find((user) => user.id === id);
    }

    findAll(): User[] {
        return [...this.users];
    }

    create(user: Omit<User, 'id'>): User {
        const created = { id: String(this.users.length + 1), ...user };
        this.users.push(created);
        return created;
    }
}
