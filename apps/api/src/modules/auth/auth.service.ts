import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@repo/database';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserDto, OrganizationDto } from '@repo/types';
import { randomBytes, createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: UserDto; organization: OrganizationDto }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
    const orgSlug = dto.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
          },
        });

        const org = await tx.organization.create({
          data: {
            name: dto.organizationName,
            slug: `${orgSlug}-${randomBytes(4).toString('hex')}`,
          },
        });

        let ownerRole = await tx.role.findFirst({ where: { name: 'Owner' } });
        if (!ownerRole) {
          ownerRole = await tx.role.create({
            data: { name: 'Owner', description: 'Organization Owner' },
          });
        }

        const _membership = await tx.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            roleId: ownerRole.id,
          },
        });

        return { user, org };
      });

      // Audit after transaction commits so the FK reference to org.id exists
      await this.auditService.logEvent({
        organizationId: result.org.id,
        actorUserId: result.user.id,
        action: 'user.registered',
        entityType: 'User',
        entityId: result.user.id,
      });

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          isActive: result.user.isActive,
          createdAt: result.user.createdAt.toISOString(),
          updatedAt: result.user.updatedAt.toISOString(),
        },
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
          isActive: result.org.isActive,
          createdAt: result.org.createdAt.toISOString(),
          updatedAt: result.org.updatedAt.toISOString(),
        },
      };
    } catch (err: unknown) {
      // Log for debugging in test/dev — never log passwords
      if (err instanceof BadRequestException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new InternalServerErrorException(`Registration failed: ${message}`);
    }
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: UserDto; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.AUTH_SECRET as string,
      expiresIn: '15m',
    });

    const refreshToken = randomBytes(32).toString('hex');
    const hashedRefreshToken = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: hashedRefreshToken,
        expiresAt,
      },
    });

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: 'user.login',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      accessToken,
      refreshToken,
    };
  }

  public hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async refreshSession(
    refreshToken: string,
  ): Promise<{ user: UserDto; accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const hashedToken = this.hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!session || !session.user || !session.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Token Rotation: Delete old session and issue new tokens
    await this.prisma.session.delete({ where: { id: session.id } });

    const newRefreshToken = randomBytes(32).toString('hex');
    const newHashedToken = this.hashToken(newRefreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: session.user.id,
        token: newHashedToken,
        expiresAt: newExpiresAt,
      },
    });

    const payload = { sub: session.user.id, email: session.user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.AUTH_SECRET as string,
      expiresIn: '15m',
    });

    await this.auditService.logEvent({
      actorUserId: session.user.id,
      action: 'user.token_refreshed',
      entityType: 'Session',
      entityId: session.id,
    });

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        isActive: session.user.isActive,
        createdAt: session.user.createdAt.toISOString(),
        updatedAt: session.user.updatedAt.toISOString(),
      },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const hashedToken = this.hashToken(refreshToken);
      await this.prisma.session.deleteMany({
        where: { userId, token: hashedToken },
      });
    } else {
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    }

    await this.auditService.logEvent({
      actorUserId: userId,
      action: 'user.logout',
      entityType: 'User',
      entityId: userId,
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            organization: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      memberships: user.memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        organizationId: m.organizationId,
        isActive: m.isActive,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        role: {
          id: m.role.id,
          name: m.role.name,
          description: m.role.description,
        },
      })),
      activeOrganization: null, // Will be filled by client interceptor/headers or standard logic
    };
  }
}
