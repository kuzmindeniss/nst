import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  Patch,
  Param,
  Delete,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './guards/auth.guard';
import { type Request } from 'express';
import { SearchQueryDto } from './dto/search.dto';
import { UpdateUserDto } from './dto/update.dto';
import { UserResponseDto, UserWithAccessToken } from './dto/user.dto';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Get()
  @ApiPaginatedResponse(UserResponseDto)
  getUsersPaginated(@Query() options: SearchQueryDto) {
    return this.usersService.getUsersPaginated(options);
  }

  @Post('register')
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
  ): Promise<UserWithAccessToken> {
    return this.usersService.register(registerDto);
  }

  @Post('login')
  async login(
    @Body(ValidationPipe) LoginDto: LoginDto,
  ): Promise<UserWithAccessToken> {
    return this.usersService.login(LoginDto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: Request): UserResponseDto {
    return req.user;
  }

  @UseGuards(AuthGuard)
  @Patch(':login')
  async update(
    @Param('login') login: string,
    @Req() req: Request,
    @Body(ValidationPipe) updates: UpdateUserDto,
  ) {
    return this.usersService.update(login, updates);
  }

  @UseGuards(AuthGuard)
  @Delete(':login')
  async delete(@Param('login') login: string) {
    return this.usersService.delete(login);
  }

  @UseGuards(AuthGuard)
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(req.user.login, file);
  }
}
