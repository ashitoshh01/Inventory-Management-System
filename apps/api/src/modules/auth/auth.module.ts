import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuditModule } from '../audit/audit.module';

import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard';

@Module({
  imports: [
    AuditModule,
    JwtModule.register({
      global: true,
      secret: process.env.AUTH_SECRET as string,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, AuthRateLimitGuard],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
