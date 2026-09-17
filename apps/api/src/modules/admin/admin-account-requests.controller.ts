import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@repo/database';
import { AdminAccountRequestsService } from './admin-account-requests.service';
import {
  AdminPaginationDto,
  AdminCreateAccountRequestDto,
  AdminUpdateAccountRequestDto,
} from './dto/admin.dto';

@Controller('admin/account-requests')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminAccountRequestsController {
  constructor(private readonly service: AdminAccountRequestsService) {}

  @Get()
  async list(
    @Query() query: AdminPaginationDto,
    @Query('status') status?: string,
  ) {
    return this.service.list({ ...query, ...(status ? { status } : {}) });
  }

  @Post()
  async create(
    @Body() dto: AdminCreateAccountRequestDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.service.create(dto, adminUser.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateAccountRequestDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.service.update(id, dto, adminUser.id);
  }
}
