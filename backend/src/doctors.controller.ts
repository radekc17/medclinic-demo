import { Controller, Get, Param, Query, Patch, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { eachDayOfInterval, format, endOfMonth, startOfMonth, getDay } from 'date-fns';
import { NotificationsGateway } from './notifications.gateway'; 

const SLOT_STEP_MINUTES = 15;

@ApiTags('Doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway 
  ) {}

  // =========================================================================
  // --- PRYWATNA METODA POMOCNICZA: POBIERANIE GABINETU (REDUKCJA BŁĘDÓW TV) ---
  // =========================================================================
  private async getResolvedRoomName(doctorId: number, userId: number, date: Date) {
    const startOfDay = new Date(date); 
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); 
    endOfDay.setHours(23, 59, 59, 999);
    const dayOfWeek = getDay(date);

    // 1. Sprawdź grafik dzienny (WorkSchedule)
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { 
        userId: userId, 
        date: { gte: startOfDay, lte: endOfDay }, 
        type: 'WORK' 
      },
      include: { room: true }
    });
    if (schedule?.room?.name) return schedule.room.name;

    // 2. Fallback do szablonu (ScheduleTemplate) - jeśli brak grafiku szczegółowego
    const template = await this.prisma.scheduleTemplate.findFirst({
      where: { 
        userId: userId, 
        dayOfWeek: dayOfWeek, 
        validFrom: { lte: date } 
      },
      include: { room: true }
    });
    if (template?.room?.name) return template.room.name;

    // 3. Fallback ostateczny (ID)
    return `GABINET NR ${doctorId}`;
  }

  // --- SEKCJA OGÓLNA (PUBLICZNA) ---

  @Get()
  @ApiOperation({ summary: 'Pobierz listę wszystkich lekarzy z ich usługami' })
  async getAll() {
    return this.prisma.doctor.findMany({
      include: {
        user: { select: { name: true, email: true } },
        availabilities: true,
        services: true
      }
    });
  }

  // --- SEKCJA RECEPCJI (WYMAGA LOGOWANIA) ---

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('reception-status')
  @ApiOperation({ summary: 'Monitoring placówki (Radar Recepcji)' })
  async getReceptionStatus() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return this.prisma.doctor.findMany({
      include: {
        user: { select: { name: true } },
        clinic: true, // <--- TO JEST KLUCZOWE
        appointments: {
          where: {
            status: { not: 'CANCELLED' },
            OR: [
              { date: { gte: todayStart, lte: todayEnd } }, // Wizyty z dzisiaj (do podglądu w Radarze)
              { manualCheckRequired: true, isConfirmed: false } // Wizyty z przyszłości do weryfikacji przez Halinkę
            ]
          },
          orderBy: { date: 'asc' },
          include: {
            patient: { select: { name: true, phone: true, pesel: true } },
            service: { select: { name: true, price: true, duration: true } } 
          }
        },
        _count: {
          select: {
            appointments: {
              where: {
                status: { not: 'CANCELLED' },
                OR: [
                  { date: { gte: todayStart, lte: todayEnd } },
                  { manualCheckRequired: true, isConfirmed: false }
                ]
              }
            }
          }
        }
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch(':id/delay')
  @ApiOperation({ summary: 'Recepcja koryguje opóźnienie lekarza (minuty)' })
  async updateDelayByReception(@Param('id') id: string, @Body('delay') delay: number) {
    const doctorId = parseInt(id);
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    
    if (!doctor) throw new NotFoundException('Nie znaleziono lekarza');

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: { currentDelay: delay }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch(':id/work-status')
  @ApiOperation({ summary: 'Recepcja zmienia tryb pracy gabinetu' })
  async updateWorkStatusByReception(@Param('id') id: string, @Body('status') status: string) {
    const doctorId = parseInt(id);
    
    const validStatuses = ['AVAILABLE', 'BREAK', 'WORK_INTERNAL'];
    if (!validStatuses.includes(status)) {
       throw new NotFoundException('Nieprawidłowy status. Dozwolone: AVAILABLE, BREAK, WORK_INTERNAL');
    }

    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Nie znaleziono lekarza');

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: { workStatus: status }
    });
  }

  // --- SEKCJA LEKARZA (PROFIL I STATUSY) ---

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('me/status')
  @ApiOperation({ summary: 'Lekarz ustawia swój status (przerwa, opóźnienie, tryb pracy)' })
  async updateStatus(@Request() req, @Body() body: { isOnBreak?: boolean, delay?: number, workStatus?: string }) {
    const doctor = await this.prisma.doctor.findUnique({ 
      where: { userId: req.user.userId } 
    });

    if (!doctor) throw new NotFoundException('Nie znaleziono profilu lekarza');

    return this.prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        isOnBreak: body.isOnBreak !== undefined ? body.isOnBreak : (doctor as any).isOnBreak,
        currentDelay: body.delay !== undefined ? body.delay : (doctor as any).currentDelay,
        workStatus: body.workStatus !== undefined ? body.workStatus : (doctor as any).workStatus
      }
    });
  }

  // --- ZARZĄDZANIE WIZYTĄ (PANEL LEKARZA v2 - SMART LOGIC) ---

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('me/appointments') 
  @ApiOperation({ summary: 'Pobierz wizyty + Auto obliczanie opóźnienia' })
  async getMyAppointments(
    @Request() req,
    @Query('date') dateString?: string
  ) {
    const userId = req.user.userId;
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new NotFoundException('Brak profilu lekarza');

    const targetDate = dateString ? new Date(dateString) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' }
      },
      orderBy: { date: 'asc' },
      include: {
        patient: { select: { name: true, pesel: true, phone: true } },
        service: { select: { name: true, duration: true } }
      }
    });

    const isToday = new Date().toDateString() === targetDate.toDateString();
    if (isToday) {
        await this.calculateAndSetAutoDelay(doctor.id, appointments);
    }

    return { appointments, queryDate: startOfDay };
  }

  // =========================================================================
  // --- SEKCJA ZMIANY STATUSU (POPRAWIONA: POBIERANIE NAZWY GABINETU DLA TV) ---
  // =========================================================================

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('appointments/:id/call')
  @ApiOperation({ summary: 'KROK 1: Wezwanie (Zapisz calledAt + Auto Delay + SYGNAŁ TV)' })
  async callPatient(@Param('id') id: string) {
    const app = await this.prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status: 'CALLED', calledAt: new Date() },
      include: { 
        patient: true,
        doctor: true 
      } 
    });
    
    await this.triggerDelayRecalculation(app.doctorId);

    // Dynamiczne pobranie nazwy pokoju
    const roomName = await this.getResolvedRoomName(app.doctorId, app.doctor.userId, new Date());

    const payloadForTv = {
      ...app,
      doctor: {
        ...app.doctor,
        room: roomName 
      }
    };

    console.log(`📢 [DoctorsController] Wezwanie: ${app.patient?.name}. Sala: ${roomName}`);
    this.notificationsGateway.broadcastUpdate('appointment_updated', payloadForTv);

    return app;
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('appointments/:id/start')
  @ApiOperation({ summary: 'KROK 2: Start (Zapisz startedAt + Auto Delay)' })
  async startAppointment(@Param('id') id: string) {
    const app = await this.prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: { patient: true, doctor: true }
    });
    await this.triggerDelayRecalculation(app.doctorId);

    const roomName = await this.getResolvedRoomName(app.doctorId, app.doctor.userId, new Date());

    const payloadForTv = { 
      ...app, 
      doctor: { 
        ...app.doctor, 
        room: roomName 
      } 
    };
    this.notificationsGateway.broadcastUpdate('appointment_updated', payloadForTv);

    return app;
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('appointments/:id/end')
  @ApiOperation({ summary: 'KROK 3: Koniec (Zapisz endedAt + Auto Delay)' })
  async endAppointment(@Param('id') id: string) {
    const app = await this.prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status: 'COMPLETED', endedAt: new Date() },
      include: { patient: true, doctor: true }
    });
    await this.triggerDelayRecalculation(app.doctorId);

    const roomName = await this.getResolvedRoomName(app.doctorId, app.doctor.userId, new Date());

    const payloadForTv = { 
      ...app, 
      doctor: { 
        ...app.doctor, 
        room: roomName 
      } 
    };
    this.notificationsGateway.broadcastUpdate('appointment_updated', payloadForTv);

    return app;
  }

  // --- LOGIKA SMART OPÓŹNIENIA (AUTO DELAY) ---

  private async triggerDelayRecalculation(doctorId: number) {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    
    const appointments = await this.prisma.appointment.findMany({
        where: { doctorId, date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
        orderBy: { date: 'asc' }
    });
    await this.calculateAndSetAutoDelay(doctorId, appointments);
  }

  private async calculateAndSetAutoDelay(doctorId: number, appointments: any[]) {
     const now = new Date();
     const firstWaiting = appointments.find(a => ['PENDING', 'CALLED'].includes(a.status));
     let autoDelay = 0;

     if (firstWaiting) {
         const plannedDate = new Date(firstWaiting.date);
         if (plannedDate < now) {
             autoDelay = Math.floor((now.getTime() - plannedDate.getTime()) / 60000);
         } else {
             autoDelay = 0;
         }
     } else {
         autoDelay = 0;
     }

     autoDelay = Math.max(0, autoDelay);

     await this.prisma.doctor.update({
         where: { id: doctorId },
         data: { currentDelay: autoDelay }
     });
  }

  // =================================================================================================
  // --- SLOTY I DOSTĘPNOŚĆ (INTEGRACJA Z GRAFIKIEM I SZABLONEM - FIX DLA MARII) ---
  // =================================================================================================

  @Get(':id/slots')
  @ApiOperation({ summary: 'Pobierz wolne godziny (Na podstawie WorkSchedule lub ScheduleTemplate)' })
  async getSlots(
    @Param('id') id: string, 
    @Query('date') dateString: string,
    @Query('serviceId') serviceId?: string
  ) {
    const doctorId = parseInt(id);
    const date = new Date(dateString);

    let serviceDuration = 30;
    if (serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
      if (service) serviceDuration = service.duration;
    }

    return this.generateDynamicSlots(doctorId, date, serviceDuration);
  }

  private async generateDynamicSlots(doctorId: number, date: Date, serviceDuration: number): Promise<string[]> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId }
    });
    
    if (!doctor) return [];
    
    const dr = doctor as any; 
    const today = new Date();
    const isTodaySelected = date.toDateString() === today.toDateString();

    if (isTodaySelected && (dr.isOnBreak || (dr.workStatus && dr.workStatus !== 'AVAILABLE'))) {
      return []; 
    }

    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
    const dayOfWeek = getDay(date);

    // 1. Sprawdź Grafik szczegółowy (WorkSchedule)
    let schedule = await this.prisma.workSchedule.findFirst({
        where: {
            userId: doctor.userId,
            date: { gte: startOfDay, lte: endOfDay },
            type: 'WORK',
        }
    });

    let workStart: Date, workEnd: Date;

    if (schedule) {
        workStart = new Date(schedule.startTime);
        workEnd = new Date(schedule.endTime);
    } else {
        // 2. FALLBACK: Sprawdź Szablon stały (ScheduleTemplate) - Kluczowe dla Marii
        const template = await this.prisma.scheduleTemplate.findFirst({
            where: {
                userId: doctor.userId,
                dayOfWeek: dayOfWeek,
                validFrom: { lte: date }
            }
        });

        if (!template) return []; 

        const [sH, sM] = template.startTime.split(':').map(Number);
        const [eH, eM] = template.endTime.split(':').map(Number);

        workStart = new Date(date); workStart.setHours(sH, sM, 0, 0);
        workEnd = new Date(date); workEnd.setHours(eH, eM, 0, 0);
    }

    const gap = doctor.gapMinutes || 5; 
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' } 
      },
      include: { service: true }
    });

    const busyIntervals = appointments.map(app => {
      const start = new Date(app.date);
      const duration = app.service?.duration || 30;
      const end = new Date(start.getTime() + (duration + gap) * 60000);
      return { start: start.getTime(), end: end.getTime() };
    });

    const availableSlots: string[] = [];
    const delayMs = (dr.currentDelay || 0) * 60000;
    const now = new Date(); 

    let currentSlot = new Date(workStart);

    // Pętla generująca sloty
    while (currentSlot < workEnd) {
      const currentStartTs = currentSlot.getTime();
      const potentialEndTs = currentStartTs + (serviceDuration + gap) * 60000;

      if (potentialEndTs > workEnd.getTime()) break;

      // Sprawdzenie opóźnienia i czasu teraźniejszego
      if (currentStartTs > (now.getTime() + delayMs + 60000)) {
        
        // WALIDACJA KOLIZJI (Naprawa błędu startTs)
        const hasCollision = busyIntervals.some(busy => {
          return (currentStartTs < busy.end && potentialEndTs > busy.start);
        });

        if (!hasCollision) {
          const hour = currentSlot.getUTCHours().toString().padStart(2, '0');
          const min = currentSlot.getUTCMinutes().toString().padStart(2, '0');
          const timeStr = `${hour}:${min}`;
          availableSlots.push(timeStr);
        }
      }

      currentSlot = new Date(currentSlot.getTime() + SLOT_STEP_MINUTES * 60000);
    }

    return availableSlots;
  }

  // --- DOSTĘPNOŚĆ MIESIĘCZNA (DLA KALENDARZA) ---

  @Get(':id/month-availability')
  @ApiOperation({ summary: 'Zwróć dni NIEDOSTĘPNE (brak grafiku i szablonu) w danym miesiącu' })
  async getMonthAvailability(
      @Param('id') id: string,
      @Query('year') yearStr: string,
      @Query('month') monthStr: string
  ) {
      const doctorId = parseInt(id);
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) return [];

      const start = new Date(year, month - 1, 1);
      const end = endOfMonth(start);

      const schedules = await this.prisma.workSchedule.findMany({
          where: {
              userId: doctor.userId,
              date: { gte: start, lte: end },
              type: 'WORK'
          },
          select: { date: true }
      });

      const templates = await this.prisma.scheduleTemplate.findMany({
          where: { userId: doctor.userId }
      });

      const workingDates = new Set(schedules.map(s => format(s.date, 'yyyy-MM-dd')));
      const templateDays = new Set(templates.map(t => t.dayOfWeek));

      const daysInMonth = eachDayOfInterval({ start, end });
      const busyDates: string[] = [];

      daysInMonth.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          // Dzień jest zajęty tylko jeśli nie ma go w grafiku ORAZ nie ma go w szablonie
          if (!workingDates.has(dateStr) && !templateDays.has(getDay(day))) {
              busyDates.push(dateStr);
          }
      });

      return busyDates;
  }

  @Get(':id/next-available')
  @ApiOperation({ summary: 'Znajdź najbliższy wolny termin (oparty o grafik/szablon)' })
  async findNextAvailable(@Param('id') id: string, @Query('date') dateString: string) {
    const doctorId = parseInt(id);
    let checkDate = new Date(dateString);
    
    for (let i = 0; i < 60; i++) {
      checkDate.setDate(checkDate.getDate() + 1);
      const slots = await this.generateDynamicSlots(doctorId, checkDate, 30);
      if (slots.length > 0) {
        return { availableDate: format(checkDate, 'yyyy-MM-dd') };
      }
    }
    return { availableDate: null, message: 'Brak terminów w najbliższym czasie' };
  }
}