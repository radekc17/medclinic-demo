import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ShiftType, ScheduleStatus, RequestStatus, AbsenceType } from '@prisma/client';

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  // =================================================================================================
  // SEKCJJA 1: ZASOBY (GABINETY) I SZABLONY
  // =================================================================================================

  async createRoom(name: string, type: string) {
    return this.prisma.room.create({
      data: { name, type }
    });
  }

  async getRooms() {
    return this.prisma.room.findMany({ where: { isActive: true } });
  }

  async getUserTemplates(userId: number) {
    return this.prisma.scheduleTemplate.findMany({
      where: { userId },
      include: { room: true }
    });
  }

  async upsertTemplate(userId: number, dayOfWeek: number, start: string, end: string, roomId?: number) {
    const existing = await this.prisma.scheduleTemplate.findFirst({
      where: { userId, dayOfWeek }
    });

    if (existing) {
      return this.prisma.scheduleTemplate.update({
        where: { id: existing.id },
        data: { startTime: start, endTime: end, roomId, validFrom: new Date() }
      });
    }

    return this.prisma.scheduleTemplate.create({
      data: {
        userId,
        dayOfWeek,
        startTime: start,
        endTime: end,
        roomId,
        validFrom: new Date()
      }
    });
  }

  // =================================================================================================
  // SEKCJJA 2: ZARZĄDZANIE GRAFIKIEM (MANUALNE I MALOWANIE PRACĄ)
  // =================================================================================================

  // HELPER: Sprawdzanie kolizji godzin (blokuje nakładające się zmiany)
  private async checkCollision(userId: number, dateObj: Date, start: Date, end: Date, excludeShiftId?: number) {
      const shifts = await this.prisma.workSchedule.findMany({
          where: { userId, date: dateObj }
      });

      for (const shift of shifts) {
          // Jeśli edytujemy zmianę, pomijamy ją w sprawdzaniu kolizji z samą sobą
          if (excludeShiftId && shift.id === excludeShiftId) continue;

          // Logika kolizji: (StartA < EndB) i (EndA > StartB)
          if (start < shift.endTime && end > shift.startTime) {
              const conflictStart = shift.startTime.toISOString().substr(11, 5);
              const conflictEnd = shift.endTime.toISOString().substr(11, 5);
              throw new BadRequestException(`Kolizja godzin! Lekarz ma już zmianę: ${conflictStart} - ${conflictEnd}`);
          }
      }
  }

  // Edycja lub dodawanie zmiany (Obsługuje Split Shifts)
  async upsertShift(userId: number, dateStr: string, startStr: string, endStr: string, roomId?: number, type: ShiftType = 'WORK', shiftId?: number) {
      const startDateTime = new Date(`${dateStr}T${startStr}:00.000Z`);
      const endDateTime = new Date(`${dateStr}T${endStr}:00.000Z`);
      const dateObj = new Date(dateStr);

      // 1. Sprawdź czy nowa zmiana nie koliduje z innymi
      await this.checkCollision(userId, dateObj, startDateTime, endDateTime, shiftId);

      if (shiftId) {
          // AKTUALIZACJA ISTNIEJĄCEJ (np. zmiana sali lub godzin konkretnego kafelka)
          return this.prisma.workSchedule.update({
              where: { id: shiftId },
              data: { startTime: startDateTime, endTime: endDateTime, roomId, type, status: 'PUBLISHED' }
          });
      } else {
          // TWORZENIE NOWEJ (Pozwala na dwie zmiany w jeden dzień, np. rano i po południu)
          return this.prisma.workSchedule.create({
              data: {
                  userId,
                  date: dateObj,
                  startTime: startDateTime,
                  endTime: endDateTime,
                  roomId,
                  type,
                  status: 'PUBLISHED'
              }
          });
      }
  }

  // NOWOŚĆ: Usuwanie zmiany
  async deleteShift(id: number) {
      const shift = await this.prisma.workSchedule.findUnique({ where: { id } });
      if (!shift) throw new NotFoundException('Zmiana nie istnieje');
      
      return this.prisma.workSchedule.delete({ where: { id } });
  }

  // MALOWANIE GRAFIKU PRACĄ (Bulk Shift) - Dla Managera
  async createBulkShift(userId: number, dates: string[], startHour: string, endHour: string, roomId?: number) {
      const createdShifts: any[] = [];
      const errors: string[] = [];
      
      for (const dateStr of dates) {
          try {
              // Przy malowaniu (bez ID) próbujemy dodać nową zmianę.
              const shift = await this.upsertShift(userId, dateStr, startHour, endHour, roomId, 'WORK');
              createdShifts.push(shift);
          } catch (e) {
              // Zbieramy błędy (np. o kolizjach), ale nie przerywamy całej pętli
              errors.push(`Dzień ${dateStr}: Kolizja godzin`);
          }
      }
      
      // Jeśli nic się nie udało zapisać, rzuć błąd
      if (errors.length > 0 && createdShifts.length === 0) {
           throw new BadRequestException("Nie udało się zapisać zmian - kolizje w wybranych dniach.");
      }
      
      return { 
          count: createdShifts.length, 
          message: createdShifts.length > 0 ? "Grafik zaktualizowany" : "Błąd aktualizacji",
          warnings: errors 
      };
  }

  // Generowanie z szablonów (Automat)
  async generateMonthSchedule(year: number, month: number, userId?: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const templates = await this.prisma.scheduleTemplate.findMany({
      where: userId ? { userId } : {},
      include: { room: true }
    });

    const newShifts: any[] = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateStr = d.toISOString().split('T')[0];
      const matchingTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);

      for (const t of matchingTemplates) {
        // Sprawdzamy czy w tym dniu nie ma już jakiejś zmiany (np. urlopu albo ręcznie dodanej pracy)
        const exists = await this.prisma.workSchedule.findFirst({
            where: { 
                userId: t.userId, 
                date: { gte: new Date(dateStr), lt: new Date(new Date(dateStr).getTime() + 86400000) } 
            }
        });

        if (!exists) {
            newShifts.push({
                userId: t.userId,
                roomId: t.roomId,
                date: new Date(d),
                startTime: new Date(`${dateStr}T${t.startTime}:00.000Z`),
                endTime: new Date(`${dateStr}T${t.endTime}:00.000Z`),
                type: ShiftType.WORK,
                status: ScheduleStatus.DRAFT // Z automatu zawsze jako brudnopis
            });
        }
      }
    }

    if (newShifts.length > 0) {
        // @ts-ignore
        await this.prisma.workSchedule.createMany({ data: newShifts });
    }

    return { message: `Wygenerowano ${newShifts.length} zmian w grafiku (DRAFT).` };
  }

  // Pobieranie grafiku (ZMODYFIKOWANE DOŁĄCZENIE KLINIKI)
  async getSchedule(from: string, to: string, userId?: number, onlyPublished: boolean = true) {
    const whereClause: any = {
        date: { gte: new Date(from), lte: new Date(to) }
    };

    if (userId) whereClause.userId = userId;
    if (onlyPublished) whereClause.status = ScheduleStatus.PUBLISHED;

    return this.prisma.workSchedule.findMany({
        where: whereClause,
        // ZMIANA: Dołączamy informację o placówce (clinic) zaszytą w gabinecie (room)
        include: { 
          user: { select: { name: true } }, 
          room: { include: { clinic: true } } 
        },
        orderBy: { startTime: 'asc' }
    });
  }
  
  // Publikacja
  async publishSchedule(ids: number[]) {
      return this.prisma.workSchedule.updateMany({
          where: { id: { in: ids } },
          data: { status: ScheduleStatus.PUBLISHED }
      });
  }

  // =================================================================================================
  // SEKCJJA 3: OBSŁUGA WNIOSKÓW I NIEOBECNOŚCI (MALOWANIE L4/URLOPEM)
  // =================================================================================================

  // Tworzenie pojedynczego wniosku
  async createRequest(userId: number, type: AbsenceType, startDate: string, endDate: string, reason?: string) {
      return this.prisma.scheduleRequest.create({
          data: {
              userId,
              type,
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              reason,
              status: 'PENDING'
          }
      });
  }

  // Tworzenie wniosków zbiorczych (Zaznaczanie wielu dat)
  async createBulkRequest(
      userId: number, 
      type: AbsenceType, 
      dates: string[], 
      reason?: string, 
      startHour?: string, 
      endHour?: string,
      status: RequestStatus = 'PENDING' 
  ) {
      const sortedDates = dates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
      
      if (sortedDates.length === 0) return { count: 0 };

      // Formatowanie powodu, np: "[08:00-16:00] Powód"
      let finalReason = reason || (type === AbsenceType.WORK_PREFERENCE ? 'Dyspozycyjność' : 'Urlop');
      if (type === AbsenceType.WORK_PREFERENCE && startHour && endHour) {
          finalReason = `[${startHour}-${endHour}] ${finalReason}`;
      }

      // Algorytm grupowania dat w ciągłe okresy
      const ranges: { start: Date, end: Date }[] = [];
      let currentStart = sortedDates[0];
      let currentEnd = sortedDates[0];

      for (let i = 1; i < sortedDates.length; i++) {
          const diff = (sortedDates[i].getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24);
          
          if (diff === 1) {
              currentEnd = sortedDates[i];
          } else {
              ranges.push({ start: currentStart, end: currentEnd });
              currentStart = sortedDates[i];
              currentEnd = sortedDates[i];
          }
      }
      ranges.push({ start: currentStart, end: currentEnd });

      let createdCount = 0;
      for (const range of ranges) {
          // Tworzymy wniosek w bazie
          const req = await this.prisma.scheduleRequest.create({
              data: {
                  userId,
                  type,
                  startDate: range.start,
                  endDate: range.end,
                  reason: finalReason,
                  status: status // PENDING (User) lub APPROVED (Manager)
              }
          });
          createdCount++;

          // KLUCZOWE: Jeśli status to APPROVED, od razu nanosimy na grafik!
          if (status === 'APPROVED') {
              if (type === AbsenceType.WORK_PREFERENCE) {
                  await this.applyWorkPreferenceToSchedule(req);
              } else {
                  await this.applyAbsenceToSchedule(req);
              }
          }
      }

      return { count: createdCount, ranges: ranges.length };
  }

  // Pobieranie oczekujących wniosków
  async getPendingRequests() {
      return this.prisma.scheduleRequest.findMany({
          where: { status: 'PENDING' },
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'desc' }
      });
  }

  // Akceptacja/Odrzucenie wniosku (Przycisk w panelu Managera)
  async resolveRequest(requestId: number, status: 'APPROVED' | 'REJECTED', managerNote?: string) {
      const request = await this.prisma.scheduleRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Wniosek nie istnieje');

      const updated = await this.prisma.scheduleRequest.update({
          where: { id: requestId },
          data: { status: status as RequestStatus, managerNote }
      });

      if (status === 'APPROVED') {
          if (request.type === AbsenceType.WORK_PREFERENCE) {
               await this.applyWorkPreferenceToSchedule(request);
          } else {
               await this.applyAbsenceToSchedule(request);
          }
      }
      return updated;
  }

  // Akceptacja zbiorcza
  async resolveAllRequests() {
      const pending = await this.prisma.scheduleRequest.findMany({ where: { status: 'PENDING' } });
      
      let count = 0;
      for (const req of pending) {
          await this.resolveRequest(req.id, 'APPROVED', 'Zatwierdzono zbiorczo');
          count++;
      }
      
      return { count };
  }

  // =================================================================================================
  // SEKCJJA 4: FUNKCJE POMOCNICZE (APLIKOWANIE DO GRAFIKU)
  // =================================================================================================

  // Konwertuje wniosek "Chcę pracować" na realne wpisy w grafiku
  private async applyWorkPreferenceToSchedule(req: any) {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);

      let startH = 8;
      let startM = 0;
      let endH = 16;
      let endM = 0;

      const timeMatch = req.reason?.match(/\[(\d{2}):(\d{2})-(\d{2}):(\d{2})\]/);
      if (timeMatch) {
          startH = parseInt(timeMatch[1]);
          startM = parseInt(timeMatch[2]);
          endH = parseInt(timeMatch[3]);
          endM = parseInt(timeMatch[4]);
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
           // Tutaj też używamy checkCollision, żeby nie nadpisać istniejących
           try {
               const sTime = new Date(d); sTime.setHours(startH, startM, 0, 0);
               const eTime = new Date(d); eTime.setHours(endH, endM, 0, 0);
               
               // Sprawdzamy kolizję - jeśli jest, ten dzień zostanie pominięty (wpadnie w catch)
               await this.checkCollision(req.userId, d, sTime, eTime);

               await this.prisma.workSchedule.create({
                   data: {
                       userId: req.userId,
                       date: new Date(d),
                       startTime: sTime,
                       endTime: eTime,
                       type: ShiftType.WORK,
                       status: ScheduleStatus.DRAFT,
                       note: 'Z prośby pracownika'
                   }
               });
           } catch(e) { 
               // Ignorujemy błąd kolizji przy imporcie z wniosków - po prostu nie dodajemy tego dnia
           }
      }
  }

  // Konwertuje wniosek "Urlop/L4" na wpis w grafiku (blokujący)
  private async applyAbsenceToSchedule(req: any) {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          // Kasujemy cokolwiek tam było (praca znika, wchodzi urlop)
          await this.prisma.workSchedule.deleteMany({
              where: { userId: req.userId, date: d }
          });

          // Wstawiamy wpis informacyjny
          await this.prisma.workSchedule.create({
              data: {
                  userId: req.userId,
                  date: new Date(d),
                  startTime: new Date(d.setHours(9,0)), 
                  endTime: new Date(d.setHours(17,0)),
                  type: ShiftType.WORK,
                  status: ScheduleStatus.PUBLISHED, 
                  note: req.type // "VACATION", "SICK_LEAVE", "ON_DEMAND"
              }
          });
      }
  }
}