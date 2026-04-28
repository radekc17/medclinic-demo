import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { format, subHours } from 'date-fns';
import { MailService } from './mail.service'; // <--- DODANO IMPORT

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService // <--- DODANO WSTRZYKNIĘCIE
  ) {}

  // --- GŁÓWNY AUTOMAT ---
  @Cron('0 */15 * * * *') // Uruchamia się co 15 minut
  async handleAutomatedNotifications() {
    this.logger.log('🚀 Uruchamiam automat powiadomień (SMS + EMAIL)...');
    
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) return;

    const now = new Date();
    // 1. Znajdź wizyty dla pierwszego kontaktu
    const longTermLimit = new Date(now.getTime() + settings.longTermSmsHours * 60 * 60 * 1000);

    const appointmentsToNotify = await this.prisma.appointment.findMany({
      where: {
        status: 'PENDING',
        isConfirmed: false,
        confirmationSentAt: null,
        date: { lte: longTermLimit, gte: now }
      },
      include: { 
        patient: true,
        doctor: { include: { user: true } } 
      }
    });

    for (const app of appointmentsToNotify) {
      await this.sendDoubleNotification(app);
    }

    // 2. LOGIKA DLA PANI HALINKI (2-ETAP)
    const verificationThreshold = subHours(now, 3);
    
    if (!settings.skipManualVerification) {
        await this.prisma.appointment.updateMany({
            where: {
                isConfirmed: false,
                status: 'PENDING',
                manualCheckRequired: false,
                confirmationSentAt: { lte: verificationThreshold },
                date: { gte: now }
            },
            data: {
                manualCheckRequired: true
            }
        });
    }
  }

  private async sendDoubleNotification(app: any) {
    const phone = app.patient?.phone || app.guestPhone;
    const email = app.patient?.email || app.guestEmail;
    const patientName = app.patient?.name || app.guestName;
    const dateStr = format(new Date(app.date), 'dd.MM HH:mm');
    const doctorName = app.doctor?.user?.name || 'Lekarz';

    this.logger.log(`Wysyłam powiadomienie do: ${patientName}`);

    if (phone) {
      this.logger.log(`[SMS] do ${phone}: Wizyta ${dateStr}.`);
    }

    if (email) {
      this.logger.log(`[EMAIL] Inicjowanie wysyłki do ${email}...`);
      
      // --- USUNIĘTO GENEROWANIE LINKU (MAIL STARTOWY JEST TYLKO INFO) ---
      
      try {
        await this.mailService.sendNewVisitEmail(
          email,
          patientName,
          app.id, // <--- TUTAJ POPRAWIONE NA app.id
          dateStr,
          doctorName
        );
        this.logger.log(`✅ [EMAIL] Sukces! Wysłano powiadomienie do ${email}`);
      } catch (err) {
        this.logger.error(`❌ [EMAIL] Błąd wysyłki do ${email}: ${err.message}`);
      }
    }

    await this.prisma.appointment.update({
      where: { id: app.id },
      data: {
        confirmationSentAt: new Date(),
        smsSent: !!phone,
        emailSent: !!email,
        lastContactAttempt: new Date()
      }
    });
  }

  async manualConfirmByReception(appId: number) {
    return this.prisma.appointment.update({
      where: { id: appId },
      data: {
        isConfirmed: true,
        manualCheckRequired: false,
        status: 'CONFIRMED'
      }
    });
  }
}