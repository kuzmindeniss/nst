import {
  IsString,
  IsEmail,
  IsNumber,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Login must be at least 3 characters long' })
  login: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsNumber({}, { message: 'Age must be a number' })
  age: number;

  @IsOptional()
  @IsString()
  description?: string;
}
