import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowPasswordChangePending } from '../../common/decorators/allow-password-change-pending.decorator';
import { ProfileService } from './profile.service';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/profile.dto';
import { ChangePasswordDto } from '../auth/dto/auth.dto';
import { ProfileResponse, UserDto } from '@repo/types';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }): Promise<ProfileResponse> {
    return this.profileService.getProfile(user.id);
  }

  @Patch()
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<{ user: UserDto }> {
    const updated = await this.profileService.updateProfile(user.id, dto);
    return { user: updated };
  }

  @Patch('me')
  async updateProfileMe(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<{ user: UserDto }> {
    const updated = await this.profileService.updateProfile(user.id, dto);
    return { user: updated };
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
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
