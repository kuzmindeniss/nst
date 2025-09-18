import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Avatar } from './avatar.entity';
import { FilesModule } from 'src/providers/files/files.module';
import { UserRepository } from './repositories/user.repository';
import { AvatarRepository } from './repositories/avatar.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Avatar]),
    FilesModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [UsersService, UserRepository, AvatarRepository],
  controllers: [UsersController],
})
export class UsersModule {}
