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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, QueryCategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { User, Organization } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';

@Controller('categories')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequirePermissions('category.create')
  async create(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: CreateCategoryDto,
    @Req() req: RequestWithId,
  ) {
    const category = await this.categoriesService.create(org.id, user.id, dto, req.id);
    return category;
  }

  @Get()
  @RequirePermissions('category.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryCategoryDto,
    @Req() req: RequestWithId,
  ) {
    const categories = await this.categoriesService.findAll(org.id, query, req.id);
    return categories;
  }

  @Get(':id')
  @RequirePermissions('category.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    const category = await this.categoriesService.findOne(id, org.id);
    return category;
  }

  @Patch(':id')
  @RequirePermissions('category.update')
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: UpdateCategoryDto,
    @Req() req: RequestWithId,
  ) {
    const category = await this.categoriesService.update(id, org.id, user.id, dto, req.id);
    return category;
  }

  @Delete(':id')
  @RequirePermissions('category.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    const result = await this.categoriesService.delete(id, org.id, user.id, req.id);
    return result;
  }
}
