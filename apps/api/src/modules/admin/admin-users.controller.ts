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
import { AdminUsersService } from './admin-users.service';
import {
  AdminPaginationDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminAddMembershipDto,
  AdminUpdateMembershipDto,
} from './dto/admin.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  async list(@Query() query: AdminPaginationDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Post()
  async create(
    @Body() dto: AdminCreateUserDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.usersService.create(dto, adminUser.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.usersService.update(id, dto, adminUser.id);
  }

  @Post(':id/memberships')
  async addMembership(
    @Param('id') userId: string,
    @Body() dto: AdminAddMembershipDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.usersService.addMembership(userId, dto, adminUser.id);
  }

  @Patch(':id/memberships/:membershipId')
  async updateMembership(
    @Param('id') userId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: AdminUpdateMembershipDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.usersService.updateMembership(userId, membershipId, dto, adminUser.id);
  }
}
