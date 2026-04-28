// backend/src/appointments/appointments.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsGateway } from '../notifications.gateway'; // <--- 1. IMPORTUJEMY BRAMKĘ

@Injectable()
export class AppointmentsService {
  // <--- 2. WSTRZYKUJEMY BRAMKĘ DO KONSTRUKTORA
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway 
  ) {}

  // --- TWORZENIE WIZYTY (Z ZABEZPIECZENIEM PRZED KOLIZJĄ) ---
  async create(data: any) {
    let { doctorId, date, serviceId, patientId, guestName, guestEmail, guestPesel, guestPhone } = data;
    const appointmentDate = new Date(date);

    // A. Logika łączenia Gościa z Kontem (jeśli istnieje user o takim PESELU)
    if (!patientId && guestPesel) {
      const existingUser = await this.prisma.user.findUnique({
        where: { pesel: guestPesel }
      });
      if (existingUser) {
        patientId = existingUser.id;
      }
    }

    // B. Pobierz ustawienia lekarza (gapMinutes)
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Lekarz nie istnieje');
    const gap = doctor.gapMinutes || 5;

    // C. Pobierz czas trwania usługi
    let duration = 30;
    if (serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) throw new BadRequestException('Usługa nie istnieje');
      duration = service.duration;
    }

    // D. Oblicz czasy NOWEJ wizyty
    const newStart = appointmentDate.getTime();
    const newEnd = newStart + (duration + gap) * 60000;

    // E. Pobierz inne wizyty z tego dnia
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' }
      },
      include: { service: true }
    });

    // F. SPRAWDŹ CZY NIE MA KOLIZJI
    const hasCollision = existingAppointments.some(existing => {
      const existingStart = new Date(existing.date).getTime();
      const existingDuration = existing.service?.duration || 30;
      const existingEnd = existingStart + (existingDuration + gap) * 60000;

      // Czy przedziały na siebie nachodzą?
      return (newStart < existingEnd && newEnd > existingStart);
    });

    if (hasCollision) {
      throw new BadRequestException('Ten termin jest już zajęty! Proszę wybrać inną godzinę.');
    }

    // G. Zapisz wizytę
    const newAppointment = await this.prisma.appointment.create({
      data: {
        doctorId,
        date: appointmentDate,
        status: 'PENDING',
        patientId,
        serviceId,
        guestName,
        guestEmail,
        guestPhone,
        guestPesel,
        smsCode: '1234'
      },
      include: { patient: true } // Ważne dla powiadomień
    });

    // <--- 3. POWIADOMIENIE (Nowa wizyta pojawi się od razu w systemie)
    this.notificationsGateway.broadcastUpdate('appointment_updated', newAppointment);

    return newAppointment;
  }

  // --- ZMIANA STATUSU (TEJ METODY BRAKOWAŁO DLA TV!) ---
  async updateStatus(id: number, status: string, userId: number) {
    // Sprawdzamy czy wizyta należy do lekarza (opcjonalne, dla bezpieczeństwa)
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, doctor: { userId } }
    });

    if (!appointment) throw new NotFoundException('Brak uprawnień lub wizyty.');

    // Aktualizujemy status
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { 
        status,
        // Opcjonalnie zapisujemy czas wezwania/startu
        calledAt: status === 'CALLED' ? new Date() : undefined,
        startedAt: status === 'IN_PROGRESS' ? new Date() : undefined,
        endedAt: status === 'COMPLETED' ? new Date() : undefined
      },
      // <--- KLUCZOWE: Pobieramy dane pacjenta, żeby TV wyświetlił nazwisko
      include: { 
        patient: true,
        service: true
      }
    });

    console.log(`📡 [Service] Zmiana statusu ID ${id} na ${status}. Wysyłam do TV.`);
    
    // <--- 4. WYSYŁAMY SYGNAŁ DO TELEWIZORA
    this.notificationsGateway.broadcastUpdate('appointment_updated', updated);

    return updated;
  }

  // --- POZOSTAŁE METODY (Przeniesione z kontrolera) ---

  async checkGuest(pesel: string) {
    return this.prisma.appointment.findMany({
      where: {
        OR: [
          { guestPesel: pesel },
          { patient: { pesel: pesel } }
        ]
      },
      include: { doctor: { include: { user: true } }, service: true },
      orderBy: { date: 'asc' }
    });
  }

  async guestCancel(id: number, pesel: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id,
        OR: [
          { guestPesel: pesel },
          { patient: { pesel: pesel } }
        ]
      }
    });

    if (!appointment) throw new BadRequestException('Nie znaleziono wizyty pasującej do PESEL.');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { patient: true }
    });

    // Powiadomienie o anulowaniu
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

    // Emitujemy zdarzenie anulowania (ręcznie, bo updateMany zwraca tylko licznik)
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
}