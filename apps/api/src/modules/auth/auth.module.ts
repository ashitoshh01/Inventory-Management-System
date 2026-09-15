import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuditModule } from '../audit/audit.module';

import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard';

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('AUTH_SECRET') ||
          process.env.AUTH_SECRET ||
          'default_fallback_jwt_secret_min_32_chars_long';
        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
    }),
  ],
  providers: [AuthService, AuthRateLimitGuard],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
