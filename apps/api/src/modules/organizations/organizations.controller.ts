import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organizations.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { User } from '@repo/database';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateOrganizationDto) {
    const org = await this.orgsService.create(user.id, dto);
    return org;
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    const orgs = await this.orgsService.findAllForUser(user.id);
    return orgs;
  }

  // The following routes require organization context
  @Get(':id')
  @UseGuards(OrganizationGuard, PermissionsGuard)
  @RequirePermissions('organization.read')
  async findOne(@Param('id') id: string) {
    const org = await this.orgsService.findOne(id);
    return org;
  }

  @Patch(':id')
  @UseGuards(OrganizationGuard, PermissionsGuard)
  @RequirePermissions('organization.manage')
  async update(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: UpdateOrganizationDto) {
    const org = await this.orgsService.update(id, user.id, dto);
    return org;
  }
}
