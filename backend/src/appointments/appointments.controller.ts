import { Controller, Post, Body, Get, UseGuards, Request, Patch, Param, BadRequestException, Logger, Res, Query } from '@nestjs/common';
import type { Response } from 'express'; // <--- NAPRAWA BŁĘDU: Dodano 'type'
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './create-appointment.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  private readonly logger = new Logger(AppointmentsController.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  // === PACJENT KLIKA W LINK W MAILU ===
  @Get('confirm-link/:token')
  @ApiOperation({ summary: 'Potwierdzenie wizyty z linku e-mail' })
  async confirmByLink(@Param('token') token: string, @Res() res: Response) {
    try {
      await this.appointmentsService.confirmByToken(token);
      res.send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 100px; color: #059669;">
          <h1 style="font-size: 3rem;">✅ Wizyta potwierdzona!</h1>
          <p style="font-size: 1.2rem; color: #475569;">Dziękujemy. Oczekujemy na Ciebie w gabinecie.</p>
        </div>
      `);
    } catch (e) {
      res.send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 100px; color: #dc2626;">
          <h1 style="font-size: 3rem;">❌ Błąd</h1>
          <p style="font-size: 1.2rem; color: #475569;">Link wygasł, jest nieprawidłowy lub wizyta została już odwołana.</p>
        </div>
      `);
    }
  }

  // ========================================================================
  // --- NOWOŚĆ: ENDPOINTY DLA WYSZUKIWARKI I PRZEKŁADANIA (RECEPCJA) ---
  // ========================================================================

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('reception-search')
  @ApiOperation({ summary: 'Wyszukiwarka wizyt dla recepcji (po dacie i tekście)' })
  async searchForReception(@Query('date') date: string, @Query('query') query: string) {
    return this.appointmentsService.searchForReception(date, query);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('reception-reschedule/:id')
  @ApiOperation({ summary: 'Recepcja przekłada wizytę na nowy termin' })
  async rescheduleForReception(@Param('id') id: string, @Body('newDate') newDate: string) {
    return this.appointmentsService.rescheduleForReception(parseInt(id), new Date(newDate));
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('reception-cancel/:id')
  @ApiOperation({ summary: 'Recepcja odwołuje wizytę (Override)' })
  async cancelByReception(@Param('id') id: string) {
    return this.appointmentsService.cancelByReception(parseInt(id));
  }

  // ========================================================================

  @Get('trigger-cron-manual')
  @ApiOperation({ summary: 'Ręczne odpalenie robota (tylko do prezentacji!)' })
  async triggerCron() {
    await this.appointmentsService.processUpcomingAppointments();
    return { message: 'Robot przetworzył wizyty (48h i 24h) pomyślnie!' };
  }

  @Get('test-email')
  @ApiOperation({ summary: 'Wymusza testowe wysłanie maila' })
  async testEmail() {
    this.logger.log('Wysyłam testowego maila do radekc17@gmail.com...');
    return this.appointmentsService.sendTestEmail('radekc17@gmail.com');
  }

  @Post('guest-check')
  @ApiOperation({ summary: 'Pobierz wizyty po numerze PESEL' })
  async checkGuest(@Body() body: { pesel: string }) {
    return this.appointmentsService.checkGuest(body.pesel);
  }

  @Patch('guest-cancel/:id')
  @ApiOperation({ summary: 'Odwołaj jako Gość' })
  async guestCancel(@Param('id') id: string, @Body() body: { pesel: string }) {
    return this.appointmentsService.guestCancel(parseInt(id), body.pesel);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('my')
  async getMy(@Request() req) {
    return this.appointmentsService.getMy(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('doctor/:id')
  @ApiOperation({ summary: 'Pobierz wizyty dla konkretnego lekarza' })
  async getForDoctor(@Param('id') id: string) {
    return this.appointmentsService.findAllByDoctor(parseInt(id));
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Lekarz zmienia status wizyty' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Request() req) {
    this.logger.log(`📢 [KONTROLER] Otrzymano prośbę zmiany statusu! ID: ${id}, Status: ${body.status}`);
    return this.appointmentsService.updateStatus(parseInt(id), body.status, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req) {
    return this.appointmentsService.cancelMy(parseInt(id), req.user.userId);
  }

  @Get()
  async getAll() {
    return this.appointmentsService.getAllAdmin();
  }

  @Post()
  async create(@Body() data: CreateAppointmentDto) {
    return this.appointmentsService.create(data);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Recepcjonistka potwierdza wizytę manualnie' })
  async confirmByReception(@Param('id') id: string) {
    return this.appointmentsService.manualConfirm(parseInt(id));
  }
}