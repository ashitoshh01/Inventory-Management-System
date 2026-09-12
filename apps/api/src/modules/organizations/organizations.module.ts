import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { MembershipsController } from './memberships/memberships.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController, MembershipsController]
})
export class OrganizationsModule {}
