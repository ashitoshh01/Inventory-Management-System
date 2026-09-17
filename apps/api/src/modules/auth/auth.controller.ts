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
  ForbiddenException,
} from '@nestjs/common';

import { Response, Request } from 'express';

import { AuthService } from './auth.service';

import { LoginDto, ChangePasswordDto } from './dto/auth.dto';

import {
  LoginResponse,
  AuthMeResponse,
} from '@repo/types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowPasswordChangePending } from '../../common/decorators/allow-password-change-pending.decorator';

import {
  AuthRateLimitGuard,
  RateLimit,
} from '../../common/guards/auth-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Public registration is disabled.
   * Account creation is only available through the admin panel.
   */
  @Post('register')
  @HttpCode(HttpStatus.FORBIDDEN)
  async register(): Promise<never> {
    throw new ForbiddenException(
      'Public registration is disabled. Please contact the administrator to request an account.',
    );
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
    const sameSite = isSecure ? 'none' : 'lax';

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
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

    const isSecure =
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production';
    const sameSite = isSecure ? 'none' : 'lax';

    try {
      const result = await this.authService.refreshSession(token);

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return { user: result.user };
    } catch (err) {
      res.clearCookie('accessToken', { httpOnly: true, secure: isSecure, sameSite });
      res.clearCookie('refreshToken', { httpOnly: true, secure: isSecure, sameSite });

      throw err;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangePending()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: { id: string },
  ) {
    const refreshToken = req.cookies?.['refreshToken'];

    await this.authService.logout(user.id, refreshToken);

    const isSecure =
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production';
    const sameSite = isSecure ? 'none' : 'lax';

    res.clearCookie('accessToken', { httpOnly: true, secure: isSecure, sameSite });
    res.clearCookie('refreshToken', { httpOnly: true, secure: isSecure, sameSite });

    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangePending()
  async getMe(
    @CurrentUser() user: { id: string },
  ): Promise<AuthMeResponse> {
    const result = await this.authService.getMe(user.id);

    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChangePending()
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.id, dto);

    const isSecure =
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production';
    const sameSite = isSecure ? 'none' : 'lax';

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { success: true, user: result.user };
  }
}