import { OmitType } from '@nestjs/swagger';
import { User } from '../user.entity';

export class UserResponseDto extends OmitType(User, [
  'password',
  'avatars',
] as const) {}

export class UserWithAccessToken {
  user: UserResponseDto;
  accessToken: string;
}
