import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';
import { CreateMembershipDto, UpdateMembershipDto } from '../dto/organizations.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { User } from '@repo/database';

@Controller('organizations/:id/members')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class MembershipsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  @RequirePermissions('member.read')
  async findMembers(@Param('id') id: string) {
    const members = await this.orgsService.findMembers(id);
    return members;
  }

  @Post()
  @RequirePermissions('member.manage')
  async addMember(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: CreateMembershipDto,
  ) {
    const membership = await this.orgsService.addMember(id, user.id, dto);
    return membership;
  }

  @Patch(':memberId')
  @RequirePermissions('member.manage')
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateMembershipDto,
  ) {
    const membership = await this.orgsService.updateMember(id, memberId, user.id, dto);
    return membership;
  }
}
