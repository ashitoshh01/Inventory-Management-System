import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditQueryDto } from './dto/admin.dto';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  async list(@Query() query: AdminAuditQueryDto) {
    return this.auditService.list(query);
  }
}
