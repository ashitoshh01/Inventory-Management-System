import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { Response, Request } from 'express';

import { AuthService } from './auth.service';

import { RegisterDto, LoginDto } from './dto/auth.dto';

import {
  RegisterResponse,
  LoginResponse,
  AuthMeResponse,
} from '@repo/types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import {
  AuthRateLimitGuard,
  RateLimit,
} from '../../common/guards/auth-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 60, keyPrefix: 'register' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    const result = await this.authService.register(dto);

    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'login' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(dto);

    const isSecure =
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production';

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { user: result.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @UseGuards(AuthRateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 60, keyPrefix: 'refresh' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refreshToken'];

    try {
      const result = await this.authService.refreshSession(token);

      const isSecure =
        process.env.COOKIE_SECURE === 'true' ||
        process.env.NODE_ENV === 'production';

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'none',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return { user: result.user };
    } catch (err) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      throw err;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: { id: string },
  ) {
    const refreshToken = req.cookies?.['refreshToken'];

    await this.authService.logout(user.id, refreshToken);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(
    @CurrentUser() user: { id: string },
  ): Promise<AuthMeResponse> {
    const result = await this.authService.getMe(user.id);

    return result;
  }
}