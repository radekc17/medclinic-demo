import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsGateway } from '../notifications.gateway'; 
import { getDay } from 'date-fns';
import { format } from 'date-fns'; // <--- DODANO IMPORT
import { MailService } from '../mail.service'; // <--- DODANO IMPORT
import { Cron } from '@nestjs/schedule'; // <--- DODANO IMPORT CRONA

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly mailService: MailService // <--- DODANO WSTRZYKNIĘCIE
  ) {}

  // === METODA TESTOWA DO MAILI ===
  async sendTestEmail(email: string) {
    try {
      await this.mailService.sendNewVisitEmail(
        email, 
        'Radek (Test Systemu)', 
        999, 
        '24.12.2026 12:00', 
        'Lekarz Testowy'
      );
      return { success: true, message: `Wysłano testowy e-mail na ${email}` };
    } catch (error) {
      console.error('Błąd testowej wysyłki:', error);
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // --- PRYWATNA METODA POMOCNICZA: ROZWIĄZYWANIE GABINETU (FIX DLA TV) ---
  // =========================================================================
  private async getResolvedRoomName(doctorId: number, userId: number, date: Date) {
    const startOfDay = new Date(date); 
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); 
    endOfDay.setHours(23, 59, 59, 999);
    const dayOfWeek = getDay(date);

    // 1. Sprawdź Grafik szczegółowy (WorkSchedule)
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { 
        userId: userId, 
        date: { gte: startOfDay, lte: endOfDay }, 
        type: 'WORK' 
      },
      include: { room: true }
    });
    if (schedule?.room?.name) return schedule.room.name;

    // 2. Fallback do szablonu (ScheduleTemplate)
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

  // --- TWORZENIE WIZYTY ---
  async create(data: any) {
    let { doctorId, date, serviceId, patientId, guestName, guestEmail, guestPesel, guestPhone } = data;
    const appointmentDate = new Date(date);

    // 1. Automatyczna obsługa kartoteki (tworzenie pacjenta z PESEL)
    if (guestPesel) {
      const existingUser = await this.prisma.user.findUnique({
        where: { pesel: guestPesel }
      });

      if (existingUser) {
        patientId = existingUser.id;
      } else if (!patientId) {
        const newUser = await this.prisma.user.create({
          data: {
            name: guestName,
            pesel: guestPesel,
            email: guestEmail,
            phone: guestPhone,
            role: 'PATIENT',
            password: 'LOCKED_' + Math.random().toString(36).slice(-8), 
          }
        });
        patientId = newUser.id;
      }
    }

    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Lekarz nie istnieje');
    
    // Pobranie ustawień lekarza
    const gap = doctor.gapMinutes ?? 5;
    const limitDaily = doctor.ruleMaxDailyPerPatient ?? 1;
    const limitFuture = doctor.ruleMaxFutureVisits ?? 3;
    const minGapDays = doctor.ruleMinGapDays ?? 0;

    let duration = 30;
    if (serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) throw new BadRequestException('Usługa nie istnieje');
      duration = service.duration;
    }

    const newStart = appointmentDate.getTime();
    const newEnd = newStart + (duration + gap) * 60000;

    // 2. Walidacja kolizji i limitów (Pełna logika oryginału)
    if (patientId || guestPesel) {
      // Sprawdzenie czy pacjent nie ma już wizyty o tej godzinie
      const exactCollision = await this.prisma.appointment.findFirst({
        where: {
          OR: [
              { patientId: patientId || undefined },
              { guestPesel: guestPesel || undefined }
          ],
          date: appointmentDate, 
          status: { not: 'CANCELLED' }
        }
      });
      if (exactCollision) throw new BadRequestException('Masz już umówioną wizytę o tej godzinie!');

      // Sprawdzenie limitów dziennych i przyszłych
      const patientAppointments = await this.prisma.appointment.findMany({
        where: {
          doctorId: doctorId,
          OR: [{ patientId: patientId || -1 }, { guestPesel: guestPesel || '00000000000' }],
          status: { not: 'CANCELLED' }
        },
        orderBy: { date: 'desc' }
      });

      const startOfDayT = new Date(appointmentDate); startOfDayT.setHours(0,0,0,0);
      const endOfDayT = new Date(appointmentDate); endOfDayT.setHours(23,59,59,999);
      const visitsToday = patientAppointments.filter(app => app.date >= startOfDayT && app.date <= endOfDayT).length;
      if (visitsToday >= limitDaily) throw new BadRequestException(`Limit wizyt dziennych: ${limitDaily}.`);

      const futureVisits = patientAppointments.filter(app => app.date > new Date()).length;
      if (futureVisits >= limitFuture) throw new BadRequestException(`Limit aktywnych rezerwacji: ${limitFuture}.`);

      if (minGapDays > 0 && patientAppointments.length > 0) {
        const lastVisitDate = patientAppointments[0].date;
        const diffDays = Math.ceil(Math.abs(appointmentDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)); 
        if (diffDays < minGapDays) throw new BadRequestException(`Wymagany odstęp: ${minGapDays} dni.`);
      }
    }

    // Sprawdzenie kolizji w kalendarzu lekarza
    const startOfDay = new Date(appointmentDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate); endOfDay.setHours(23, 59, 59, 999);

    const doctorApps = await this.prisma.appointment.findMany({
      where: { doctorId, date: { gte: startOfDay, lte: endOfDay }, status: { not: 'CANCELLED' } },
      include: { service: true }
    });

    const hasCollision = doctorApps.some(ex => {
      const exStart = new Date(ex.date).getTime();
      const exEnd = exStart + ((ex.service?.duration || 30) + gap) * 60000;
      return (newStart < exEnd && newEnd > exStart);
    });

    if (hasCollision) throw new BadRequestException('Termin zajęty.');

    // 3. Logika statusu (Twarde sprawdzenie: rezerwacja dzisiaj na dzisiaj)
    const now = new Date();
    const isSameDayBooking = now.toDateString() === appointmentDate.toDateString(); 
    const isLastMinute = isSameDayBooking; 

    // --- DODANE: GENEROWANIE UNIKALNEGO TOKENA ---
    const confirmToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const newAppointment = await this.prisma.appointment.create({
      data: {
        doctorId, 
        date: appointmentDate, 
        status: isLastMinute ? 'CONFIRMED' : 'PENDING', 
        isConfirmed: isLastMinute, 
        manualCheckRequired: false,
        confirmationToken: confirmToken, // <--- DODANE ZAPISYWANIE TOKENA
        patientId, 
        serviceId, 
        guestName, 
        guestEmail, 
        guestPhone, 
        guestPesel, 
        smsCode: '1234'
      },
      include: { patient: true, doctor: { include: { user: true } } } 
    });

    // POBRANIE NAZWY GABINETU DLA POWIADOMIENIA
    const room = await this.getResolvedRoomName(doctorId, newAppointment.doctor.userId, appointmentDate);

    // Powiadomienie Real-time z pełnymi danymi
    this.notificationsGateway.broadcastUpdate('appointment_updated', {
      ...newAppointment,
      doctor: { ...newAppointment.doctor, room }
    });

    // <--- DODANA SEKCJA WYSYŁKI MAILA (W TLE) --->
    const recipientEmail = guestEmail || newAppointment.patient?.email;
    if (recipientEmail) {
      const dateStr = format(appointmentDate, 'dd.MM.yyyy HH:mm');
      const docName = newAppointment.doctor?.user?.name || 'Lekarz';
      const patName = guestName || newAppointment.patient?.name || 'Pacjencie';
      
      // WYSYŁAMY MAILA STARTOWEGO (BEZ PRZYCISKU POTWIERDZENIA) - równe 5 argumentów
      this.mailService.sendNewVisitEmail(recipientEmail, patName, newAppointment.id, dateStr, docName)
        .catch(err => console.error('Błąd cichej wysyłki maila:', err));
    }

    return newAppointment;
  }

  // ========================================================================
  // --- NOWOŚĆ: FUNKCJA DO POTWIERDZANIA WIZYTY PO KLIKNIĘCIU Z MAILA ---
  // ========================================================================
  async confirmByToken(token: string) {
    const app = await this.prisma.appointment.findUnique({ where: { confirmationToken: token } });
    if (!app) throw new NotFoundException('Zły lub przeterminowany link');
    
    const updated = await this.prisma.appointment.update({
      where: { id: app.id },
      data: { isConfirmed: true, manualCheckRequired: false }
    });

    this.notificationsGateway.broadcastUpdate('appointment_updated', updated);
    return updated;
  }
  // ========================================================================

  // --- MANUALNE POTWIERDZENIE ---
  async manualConfirm(id: number) {
    const app = await this.prisma.appointment.findUnique({ 
      where: { id },
      include: { doctor: true }
    });
    if (!app) throw new NotFoundException('Wizyta nie istnieje');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        isConfirmed: true,
        manualCheckRequired: false,
        status: 'PENDING'
      },
      include: { patient: true, doctor: true }
    });

    const room = await this.getResolvedRoomName(updated.doctorId, updated.doctor.userId, updated.date);

    this.notificationsGateway.broadcastUpdate('appointment_updated', {
      ...updated,
      doctor: { ...updated.doctor, room }
    });

    return updated;
  }

  // --- ZMIANA STATUSU (KLUCZOWE DLA TV) ---
  async updateStatus(id: number, status: string, userId: number) {
    // Weryfikacja czy lekarz ma prawo do tej wizyty
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, doctor: { userId } },
      include: { doctor: true }
    });

    if (!appointment) throw new NotFoundException('Brak uprawnień lub wizyty.');
    
    const updated = await this.prisma.appointment.update({ 
      where: { id }, 
      data: { 
        status,
        isConfirmed: status === 'CONFIRMED' ? true : undefined,
        calledAt: status === 'CALLED' ? new Date() : undefined,
        startedAt: status === 'IN_PROGRESS' ? new Date() : undefined,
        endedAt: status === 'COMPLETED' ? new Date() : undefined
      },
      include: { 
        patient: true,
        service: true,
        doctor: true
      } 
    });

    // Rozwiązujemy nazwę sali
    const room = await this.getResolvedRoomName(updated.doctorId, updated.doctor.userId, updated.date);

    console.log(`📡 [AppointmentService] Zmiana statusu ID: ${id} na ${status}. Sala: ${room}`);
    
    // Wysyłamy sygnał z nadpisanym polem room
    this.notificationsGateway.broadcastUpdate('appointment_updated', {
      ...updated,
      doctor: { ...updated.doctor, room }
    });
    
    return updated;
  }

  // --- INNE METODY ---

  async confirmAppointment(id: number) {
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { 
        status: 'CONFIRMED',
        isConfirmed: true,
        manualCheckRequired: false 
      },
      include: { patient: true, doctor: true }
    });

    const room = await this.getResolvedRoomName(updated.doctorId, updated.doctor.userId, updated.date);

    this.notificationsGateway.broadcastUpdate('appointment_updated', {
      ...updated,
      doctor: { ...updated.doctor, room }
    });

    return updated;
  }

  async findAllByDoctor(doctorId: number) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      include: { patient: { select: { name: true, phone: true } }, service: true },
      orderBy: { date: 'asc' }
    });
  }

  async checkGuest(pesel: string) {
    return this.prisma.appointment.findMany({
      where: { OR: [{ guestPesel: pesel }, { patient: { pesel: pesel } }] },
      include: { doctor: { include: { user: true } }, service: true },
      orderBy: { date: 'asc' }
    });
  }

  async guestCancel(id: number, pesel: string) {
    const app = await this.prisma.appointment.findFirst({
      where: { id, OR: [{ guestPesel: pesel }, { patient: { pesel: pesel } }] }
    });
    if (!app) throw new BadRequestException('Błąd weryfikacji.');
    
    const updated = await this.prisma.appointment.update({ 
      where: { id }, 
      data: { status: 'CANCELLED' },
      include: { patient: true }
    });
    this.notificationsGateway.broadcastUpdate('appointment_updated', updated);
    return updated;
  }

  async getMy(userId: number) {
    return this.prisma.appointment.findMany({
      where: { patientId: userId },
      include: { doctor: { include: { user: true } }, service: true },
      orderBy: { date: 'asc' }
    });
  }

  async cancelMy(id: number, userId: number) {
    const updated = await this.prisma.appointment.updateMany({
      where: { id, patientId: userId },
      data: { status: 'CANCELLED' }
    });
    
    this.notificationsGateway.broadcastUpdate('appointment_updated', { id, status: 'CANCELLED', patientId: userId });
    return updated;
  }

  async getAllAdmin() {
    return this.prisma.appointment.findMany({
      include: {
        doctor: { include: { user: true } },
        patient: { select: { name: true, pesel: true } },
        service: true
      }
    });
  }

  // ========================================================================
  // --- WYSZUKIWARKA DLA RECEPCJI (POZWIELA SZUKAĆ PO NAZWISKU, PESELU, DACIE) ---
  // ========================================================================
  async searchForReception(date?: string, query?: string) {
    let where: any = {
      status: { not: 'CANCELLED' } // Nie chcemy widzieć już odwołanych
    };
    
    // Jeśli Halinka wybrała datę
    if (date) {
        const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);
        where.date = { gte: startOfDay, lte: endOfDay };
    }
    
    // Jeśli Halinka wpisała coś w okienku szukania (Imię, PESEL, Telefon)
    if (query) {
        where.OR = [
            { patient: { name: { contains: query, mode: 'insensitive' } } },
            { patient: { pesel: { contains: query } } },
            { patient: { phone: { contains: query } } },
            { guestName: { contains: query, mode: 'insensitive' } },
            { guestPesel: { contains: query } },
            { guestPhone: { contains: query } }
        ];
    }

    return this.prisma.appointment.findMany({
        where,
        include: {
            patient: true,
            doctor: { include: { user: true, clinic: true } },
            service: true
        },
        orderBy: { date: 'asc' },
        take: 50 // Limitujemy do 50 wyników
    });
  }

  // ========================================================================
  // --- PRZEKŁADANIE WIZYTY PRZEZ RECEPCJĘ (ADMIN OVERRIDE) ---
  // ========================================================================
  async rescheduleForReception(id: number, newDate: Date) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, doctor: true }
    });

    if (!appointment) throw new NotFoundException('Wizyta nie istnieje');

    // 1. Walidacja: Czy nowy termin nie jest w przeszłości?
    if (newDate < new Date()) {
      throw new BadRequestException('Nie można przełożyć wizyty na datę wsteczną.');
    }

    // 2. Walidacja kolizji: Sprawdzamy, czy slot jest wolny u TEGO SAMEGO lekarza
    const startOfDay = new Date(newDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(newDate); endOfDay.setHours(23, 59, 59, 999);

    const doctorApps = await this.prisma.appointment.findMany({
      where: { 
        doctorId: appointment.doctorId, 
        date: { gte: startOfDay, lte: endOfDay }, 
        status: { not: 'CANCELLED' },
        id: { not: id } // Ignorujemy samych siebie przy sprawdzaniu kolizji
      },
      include: { service: true }
    });

    const gap = appointment.doctor.gapMinutes ?? 5;
    const duration = appointment.service?.duration ?? 30;
    const newStart = newDate.getTime();
    const newEnd = newStart + (duration + gap) * 60000;

    const hasCollision = doctorApps.some(ex => {
      const exStart = new Date(ex.date).getTime();
      const exEnd = exStart + ((ex.service?.duration || 30) + gap) * 60000;
      return (newStart < exEnd && newEnd > exStart);
    });

    if (hasCollision) {
      throw new BadRequestException('Ten termin u lekarza jest już zajęty!');
    }

    // 3. Aktualizacja
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        date: newDate,
        isConfirmed: true,
        manualCheckRequired: false,
        status: 'PENDING'
      }
    });

    this.notificationsGateway.broadcastUpdate('appointment_updated', updated);
    return updated;
  }

  // ========================================================================
  // --- NOWOŚĆ: ODWOŁYWANIE WIZYTY PRZEZ RECEPCJĘ (OMINIE BLOKADĘ LEKARZA) ---
  // ========================================================================
  async cancelByReception(id: number) {
    const app = await this.prisma.appointment.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Wizyta nie istnieje');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    this.notificationsGateway.broadcastUpdate('appointment_updated', updated);
    return updated;
  }

  // ========================================================================
  // --- ROBOT (CRON) - AUTOMATYZACJA MAILI I KOLEJKOWANIE DLA HALINKI ---
  // ========================================================================
  // --- POMOCNIK 1: LISTA POLSKICH ŚWIĄT (Stałe daty) ---
  private isPolishHoliday(date: Date): boolean {
    const day = date.getDate();
    const month = date.getMonth() + 1; // Styczeń to 0
    const holidays = [
      '1.1', '6.1', '1.5', '3.5', '15.8', '1.11', '11.11', '25.12', '26.12'
    ];
    return holidays.includes(`${day}.${month}`);
  }

  // --- POMOCNIK 2: SZUKANIE NASTĘPNEGO DNIA ROBOCZEGO ---
  private getNextBusinessDay(startDate: Date, daysToAdd: number): Date {
    let result = new Date(startDate);
    let addedDays = 0;
    while (addedDays < daysToAdd) {
      result.setDate(result.getDate() + 1);
      const isWeekend = result.getDay() === 0 || result.getDay() === 6;
      if (!isWeekend && !this.isPolishHoliday(result)) {
        addedDays++;
      }
    }
    return result;
  }

  // --- NOWY, INTELIGENTNY ROBOT (CRON) ---
  @Cron('0 8 * * *')
  async processUpcomingAppointments() {
    console.log('🤖 [CRON] Uruchamiam zaawansowany automat (Weekendy + Święta)...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // DLA MAILI: Szukamy wizyt na za 2 dni robocze (Dziś Pt -> Szuka Wt)
    const targetMailDate = this.getNextBusinessDay(today, 2);
    
    // DLA HALINKI: Szukamy wizyt na następny dzień roboczy (Dziś Pt -> Szuka Pon)
    const targetVerifyDate = this.getNextBusinessDay(today, 1);

    console.log(`📅 Robot sprawdzi: Mail na ${targetMailDate.toDateString()}, Halinka na ${targetVerifyDate.toDateString()}`);

    // --- KROK 1: WYSYŁKA MAILI (Automatyczne przypomnienie dla całego okna czasowego) ---
    const endMail = new Date(targetMailDate); endMail.setHours(23, 59, 59, 999);

    const appsToEmail = await this.prisma.appointment.findMany({
      // ZMIANA: Zamiast szukać tylko 1 konkretnego dnia, szukamy od DZIŚ do MAX TERMINU
      where: { date: { gte: today, lte: endMail }, status: 'PENDING', isConfirmed: false, emailSent: false },
      include: { patient: true, doctor: { include: { user: true } } }
    });

    for (const app of appsToEmail) {
      const email = app.guestEmail || app.patient?.email;
      if (email && app.confirmationToken) {
        const dateStr = format(new Date(app.date), 'dd.MM.yyyy HH:mm');
        await this.mailService.sendConfirmationEmail(email, app.guestName || app.patient?.name || 'Pacjencie', app.id, dateStr, app.confirmationToken);
        await this.prisma.appointment.update({ where: { id: app.id }, data: { emailSent: true } });
      }
    }

    // --- KROK 2: PRZEKAZANIE DO HALINKI (Weryfikacja ręczna) ---
    const startVerify = new Date(targetVerifyDate);
    const endVerify = new Date(targetVerifyDate); endVerify.setHours(23, 59, 59, 999);

    const result = await this.prisma.appointment.updateMany({
      where: { 
        date: { gte: startVerify, lte: endVerify }, 
        status: 'PENDING', 
        isConfirmed: false, 
        manualCheckRequired: false 
      },
      data: { manualCheckRequired: true }
    });

    if (result.count > 0) {
      console.log(`⚠️ [CRON] Przekazano ${result.count} wizyt do Halinki na ${targetVerifyDate.toLocaleDateString()}`);
      this.notificationsGateway.broadcastUpdate('radar_refresh_needed', {});
    }
  }
}