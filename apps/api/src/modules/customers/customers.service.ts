import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@repo/database';
import { CustomerDto, PaginatedResponse } from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';
import { CustomerNotFoundException, CustomerHasActiveOrdersException } from './customers.errors';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateCustomerDto,
    actorUserId?: string,
  ): Promise<CustomerDto> {
    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        email: dto.email ? dto.email.trim().toLowerCase() : null,
        phone: dto.phone ? dto.phone.trim() : null,
        address: dto.address ? dto.address.trim() : null,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'customer.created',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { name: customer.name, status: customer.status },
    });

    return this.mapToDto(customer);
  }

  async findAll(
    organizationId: string,
    query: CustomerQueryDto,
  ): Promise<PaginatedResponse<CustomerDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortOrder = query.sortOrder ? (query.sortOrder.toLowerCase() as 'asc' | 'desc') : 'desc';
    const sortBy = query.getSafeSortBy();

    const where: Prisma.CustomerWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map(this.mapToDto),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(organizationId: string, id: string): Promise<CustomerDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
    });

    if (!customer) {
      throw new CustomerNotFoundException(id);
    }

    return this.mapToDto(customer);
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerDto,
    actorUserId?: string,
  ): Promise<CustomerDto> {
    await this.findOne(organizationId, id);

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email ? dto.email.trim().toLowerCase() : null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone ? dto.phone.trim() : null } : {}),
        ...(dto.address !== undefined ? { address: dto.address ? dto.address.trim() : null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'customer.updated',
      entityType: 'Customer',
      entityId: updated.id,
      metadata: { changes: dto as unknown as Record<string, unknown> },
    });

    return this.mapToDto(updated);
  }

  async remove(organizationId: string, id: string, actorUserId?: string): Promise<void> {
    const customer = await this.findOne(organizationId, id);

    const orderCount = await this.prisma.salesOrder.count({
      where: { organizationId, customerId: id },
    });

    if (orderCount > 0) {
      throw new CustomerHasActiveOrdersException(id);
    }

    await this.prisma.customer.delete({
      where: { id },
    });

    await this.auditService.logEvent({
      organizationId,
      ...(actorUserId ? { actorUserId } : {}),
      action: 'customer.deleted',
      entityType: 'Customer',
      entityId: id,
      metadata: { name: customer.name },
    });
  }

  private mapToDto(customer: {
    id: string;
    organizationId: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: Date;
    updatedAt: Date;
  }): CustomerDto {
    return {
      id: customer.id,
      organizationId: customer.organizationId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }
}
