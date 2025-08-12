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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './guards/auth.guard';
import { type Request } from 'express';
import { SearchQueryDto } from './dto/search.dto';
import { UpdateUserDto } from './dto/update.dto';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Get()
  paginate(@Query() options: SearchQueryDto) {
    return this.usersService.paginate(options);
  }

  @Post('register')
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    return this.usersService.register(registerDto);
  }

  @Post('login')
  async login(@Body(ValidationPipe) LoginDto: LoginDto) {
    return this.usersService.login(LoginDto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.user;
  }

  @UseGuards(AuthGuard)
  @Patch(':login')
  async updateMe(
    @Param('login') login: string,
    @Req() req: Request,
    @Body(ValidationPipe) updates: UpdateUserDto,
  ) {
    return this.usersService.update(login, updates);
  }
}
