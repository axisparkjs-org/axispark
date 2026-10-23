import { IsEmail, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsString()
    @Length(2, 50)
    name: string;

    @IsInt()
    @Min(18)
    age: number;

    @IsOptional()
    @IsString({ groups: ['admin'] })
    role?: string;
}

export interface UserLike {
    email: string;
}
