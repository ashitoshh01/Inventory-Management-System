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
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { User, Organization } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';

@Controller('products')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions('product.create')
  async create(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: CreateProductDto,
    @Req() req: RequestWithId,
  ) {
    return this.productsService.create(org.id, user.id, dto, req.id);
  }

  @Get()
  @RequirePermissions('product.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryProductDto,
    @Req() req: RequestWithId,
  ) {
    return this.productsService.findAll(org.id, query, req.id);
  }

  @Get('sku/:sku')
  @RequirePermissions('product.read')
  async findBySku(@Param('sku') sku: string, @CurrentOrganization() org: Organization) {
    return this.productsService.getBySku(sku, org.id);
  }

  @Get(':id')
  @RequirePermissions('product.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.productsService.findOne(id, org.id);
  }

  @Patch(':id')
  @RequirePermissions('product.update')
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: UpdateProductDto,
    @Req() req: RequestWithId,
  ) {
    return this.productsService.update(id, org.id, user.id, dto, req.id);
  }

  @Delete(':id')
  @RequirePermissions('product.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.productsService.delete(id, org.id, user.id, req.id);
  }
}
