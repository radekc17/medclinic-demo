import { Controller, Get } from '@nestjs/common';
import { AppointmentsService } from './appointments/appointments.service';
import { MailService } from './mail.service';

@Controller('system/debug')
export class SystemController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly mailService: MailService
  ) {}

  @Get('trigger-cron')
  async triggerCron() {
    await this.appointmentsService.processUpcomingAppointments();
    return { message: 'Robot przetworzył wizyty (48h/24h) i wysłał powiadomienia.' };
  }

  // TEST MAILA STARTOWEGO (Bez przycisku)
  @Get('test-mail')
  async testMail() {
    const myEmail = 'radekc13@gmail.com'; // <--- TWÓJ E-MAIL
    await this.mailService.sendNewVisitEmail(myEmail, 'Tester Admin', 0, '01.01.2026 10:00', 'Dr Testowy');
    return { message: 'Wysłano testowy e-mail (informacyjny).' };
  }

  // --- NOWOŚĆ: TEST MAILA Z PRZYCISKIEM (Cron 48h) ---
  @Get('test-mail-link')
  async testMailLink() {
    const myEmail = 'radekc13@gmail.com'; // <--- TWÓJ E-MAIL
    const fakeToken = 'prezentacja-demo-123'; // Udajemy token z bazy
    await this.mailService.sendConfirmationEmail(myEmail, 'Tester Weryfikacji', 999, '01.01.2026 10:00', fakeToken);
    return { message: 'Wysłano testowy e-mail z linkiem do potwierdzenia.' };
  }
}