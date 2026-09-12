import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService, LivenessResult, ReadinessResult } from './health.service';
import { HealthEchoDto } from './dto/health-echo.dto';

@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('liveness')
  @HttpCode(HttpStatus.OK)
  getLiveness(): LivenessResult {
    return this.healthService.checkLiveness();
  }

  @Get('readiness')
  @HttpCode(HttpStatus.OK)
  async getReadiness(): Promise<ReadinessResult> {
    return this.healthService.checkReadiness();
  }

  @Post('echo-check')
  @HttpCode(HttpStatus.OK)
  echoCheck(@Body() dto: HealthEchoDto): { echo: string } {
    return { echo: dto.message };
  }
}
