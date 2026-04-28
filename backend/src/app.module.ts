// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { DoctorsController } from './doctors.controller';
import { AppointmentsController } from './appointments/appointments.controller';
import { UserController } from './user.controller'; 
import { AppointmentsService } from './appointments/appointments.service';
import { SettingsController } from './settings.controller'; 
import { NotificationService } from './notification.service'; 
import { NotificationsGateway } from './notifications.gateway'; 
import { MailService } from './mail.service'; 
import { ConfirmController } from './appointments/confirm.controller'; 
import { ScheduleController } from './schedule/schedule.controller';
import { ScheduleService } from './schedule/schedule.service';
import { ClinicController } from './clinic.controller'; // <--- DODANY IMPORT
import { StaffController } from './staff.controller';
import { SystemController } from './system.controller';

@Module({
  imports: [
    AuthModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
  AppController, 
  SystemController, 
  DoctorsController, 
  AppointmentsController,
  ConfirmController, 
  UserController,
  ScheduleController,
  SettingsController, 
  ClinicController,
  StaffController, // <--- O TUTAJ
],
  providers: [
    AppService, 
    PrismaService, 
    AppointmentsService,
    ScheduleService,
    NotificationService, 
    NotificationsGateway, 
    MailService, 
  ],
})
export class AppModule {}