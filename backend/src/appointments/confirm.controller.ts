import { Controller, Get, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

@Controller('confirm-visit')
export class ConfirmController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Endpoint obsługujący żądania GET z linków w wiadomościach e-mail.
   * Oczekuje parametru 'id' w adresie URL (np. /confirm-visit?id=123).
   */
  @Get()
  async confirm(@Query('id') id: string) {
    try {
      // Wywołujemy metodę manualConfirm z AppointmentsService, 
      // która ustawia isConfirmed na true i manualCheckRequired na false.
      await this.appointmentsService.manualConfirm(parseInt(id));

      // Zwracamy prosty i estetyczny widok HTML z informacją o sukcesie.
      return `
        <html>
          <head>
            <meta charset="utf-8">
            <title>Wizyta Potwierdzona</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
              .icon { font-size: 60px; color: #16a34a; margin-bottom: 20px; }
              h1 { color: #0f172a; margin: 0 0 10px 0; font-size: 24px; }
              p { color: #64748b; line-height: 1.5; }
              .btn-close { margin-top: 30px; display: inline-block; color: #2563eb; text-decoration: none; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✅</div>
              <h1>Wizyta potwierdzona!</h1>
              <p>Dziękujemy za potwierdzenie przybycia. Twoja informacja została przekazana bezpośrednio do recepcji.</p>
              <p>Możesz teraz bezpiecznie zamknąć tę kartę przeglądarki.</p>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      // W razie błędu (np. nieistniejące ID) zwracamy informację o problemie.
      return `
        <div style="text-align:center; padding-top:100px; font-family:sans-serif;">
          <h1 style="color: #dc2626;">Błąd potwierdzenia</h1>
          <p>Przepraszamy, nie udało się potwierdzić tej wizyty. Może ona być już nieaktualna.</p>
          <p>Prosimy o kontakt telefoniczny z recepcją.</p>
        </div>
      `;
    }
  }
}