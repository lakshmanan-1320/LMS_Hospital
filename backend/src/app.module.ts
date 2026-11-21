import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { databaseConfig } from './config/database.config';
import { authConfig } from './config/auth.config';
import { storageConfig } from './config/storage.config';
import { razorpayConfig } from './config/razorpay.config';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CoursesModule } from './courses/courses.module';
import { UsersModule } from './user-management/users.module';
import { EmailModule } from './email/email.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { StudentLearningModule } from './student-learning/student-learning.module';
import { DashboardModule } from './dashboard/dashboard.module';

import { InstructorsModule } from './instructors/instructors.module';
import { WebinarsModule } from './modules/webinars/webinars.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SmsModule } from './modules/sms/sms.module';
import { EmailCampaignsModule } from './modules/email-campaigns/email-campaigns.module';
import { WhatsappCampaignsModule } from './modules/whatsapp-campaigns/whatsapp-campaigns.module';
import { CartModule } from './cart/cart.module';
import { CouponsModule } from './coupons/coupons.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { RefundsModule } from './refunds/refunds.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PlatformModulesModule } from './modules/platform-modules/platform-modules.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { CertificatesModule } from './certificates/certificates.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ModuleAccessGuard } from './common/guards/module-access.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, storageConfig, razorpayConfig],
      envFilePath: ['backend/.env', '.env', '../.env'],
    }),
    JwtModule.register({
      global: true,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CategoriesModule,
    CurriculumModule,
    CoursesModule,
    EnrollmentsModule,
    StudentLearningModule,
    DashboardModule,
    UsersModule,
    EmailModule,
    InstructorsModule,
    WebinarsModule,
    SettingsModule,
    SmsModule,
    EmailCampaignsModule,
    WhatsappCampaignsModule,
    CartModule,
    CouponsModule,
    PaymentsModule,
    OrdersModule,
    RefundsModule,
    ReviewsModule,
    PlatformModulesModule,
    AuditLogsModule,
    RolesPermissionsModule,
    CertificatesModule,
  ],
  providers: [
    // Order matters: authenticate -> module availability -> roles -> permissions.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ModuleAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
