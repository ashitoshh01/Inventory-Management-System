import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { DatabaseModule } from './common/database/database.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { StructuredLogger } from './common/logger/structured-logger.service';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CoreModule } from './modules/core/core.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    CoreModule,
    HealthModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    CategoriesModule,
    ProductsModule,
  ],
  providers: [StructuredLogger],
  exports: [StructuredLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
