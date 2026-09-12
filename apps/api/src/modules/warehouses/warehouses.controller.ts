import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehouseDto } from './dto/warehouse.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { User, Organization } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @RequirePermissions('warehouse.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: CreateWarehouseDto,
    @Req() req: RequestWithId,
  ) {
    return this.warehousesService.create(org.id, user.id, dto, req.id);
  }

  @Get()
  @RequirePermissions('warehouse.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryWarehouseDto,
    @Req() req: RequestWithId,
  ) {
    return this.warehousesService.findAll(org.id, query, req.id);
  }

  @Get('code/:code')
  @RequirePermissions('warehouse.read')
  async findByCode(@Param('code') code: string, @CurrentOrganization() org: Organization) {
    return this.warehousesService.findByCode(code, org.id);
  }

  @Get(':id')
  @RequirePermissions('warehouse.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.warehousesService.findOne(id, org.id);
  }

  @Patch(':id')
  @RequirePermissions('warehouse.update')
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: UpdateWarehouseDto,
    @Req() req: RequestWithId,
  ) {
    return this.warehousesService.update(id, org.id, user.id, dto, req.id);
  }

  @Delete(':id')
  @RequirePermissions('warehouse.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ): Promise<void> {
    await this.warehousesService.delete(id, org.id, user.id, req.id);
  }
}
