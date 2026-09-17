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
import { AdminOrganizationsService } from './admin-organizations.service';
import {
  AdminPaginationDto,
  AdminCreateOrganizationDto,
  AdminUpdateOrganizationDto,
} from './dto/admin.dto';

@Controller('admin/organizations')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminOrganizationsController {
  constructor(private readonly organizationsService: AdminOrganizationsService) {}

  @Get()
  async list(@Query() query: AdminPaginationDto) {
    return this.organizationsService.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.organizationsService.getById(id);
  }

  @Post()
  async create(
    @Body() dto: AdminCreateOrganizationDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.organizationsService.create(dto, adminUser.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateOrganizationDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.organizationsService.update(id, dto, adminUser.id);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return this.organizationsService.getMembers(id);
  }
}
