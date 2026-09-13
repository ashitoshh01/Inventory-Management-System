import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { User, Organization } from '@repo/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';
import { CustomerDto, PaginatedResponse } from '@repo/types';

@Controller('customers')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions('customer.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrganization() org: Organization,
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: User,
  ): Promise<CustomerDto> {
    return this.customersService.create(org.id, dto, user?.id);
  }

  @Get()
  @RequirePermissions('customer.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: CustomerQueryDto,
  ): Promise<PaginatedResponse<CustomerDto>> {
    return this.customersService.findAll(org.id, query);
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  async findOne(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CustomerDto> {
    return this.customersService.findOne(org.id, id);
  }

  @Patch(':id')
  @RequirePermissions('customer.update')
  async update(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: User,
  ): Promise<CustomerDto> {
    return this.customersService.update(org.id, id, dto, user?.id);
  }

  @Delete(':id')
  @RequirePermissions('customer.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.customersService.remove(org.id, id, user?.id);
  }
}
