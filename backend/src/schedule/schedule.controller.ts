import { Controller, Get, Post, Body, Query, UseGuards, Request, Patch, Param, BadRequestException, Delete } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AbsenceType, RequestStatus } from '@prisma/client';

@ApiTags('Schedule & HR')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // =================================================================================================
  // SEKCJJA 1: ZASOBY (GABINETY) I SZABLONY
  // =================================================================================================

  @Post('rooms')
  @ApiOperation({ summary: 'Dodaj nowy gabinet' })
  async createRoom(@Body() body: { name: string, type: string }) {
    return this.scheduleService.createRoom(body.name, body.type);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Pobierz listę gabinetów' })
  async getRooms() {
    return this.scheduleService.getRooms();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('templates')
  @ApiOperation({ summary: 'Ustaw szablon pracy (np. Poniedziałki)' })
  async upsertTemplate(@Body() body: { userId: number, dayOfWeek: number, start: string, end: string, roomId?: number }) {
    return this.scheduleService.upsertTemplate(body.userId, body.dayOfWeek, body.start, body.end, body.roomId);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('templates')
  @ApiOperation({ summary: 'Pobierz szablony dla użytkownika' })
  async getTemplates(@Query('userId') userId: string) {
    return this.scheduleService.getUserTemplates(parseInt(userId));
  }

  // =================================================================================================
  // SEKCJJA 2: ZARZĄDZANIE ZMIANAMI (MANUALNE I MALOWANIE PRACĄ)
  // =================================================================================================

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('shift')
  @ApiOperation({ summary: 'Dodaj lub edytuj pojedynczą zmianę ręcznie' })
  async upsertShift(@Body() body: { id?: number, userId: number, date: string, start: string, end: string, roomId?: number }) {
      // Przekazujemy ID zmiany, jeśli istnieje (do edycji)
      return this.scheduleService.upsertShift(body.userId, body.date, body.start, body.end, body.roomId, 'WORK', body.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('shift/:id')
  @ApiOperation({ summary: 'Usuń zmianę z grafiku' })
  async deleteShift(@Param('id') id: string) {
      return this.scheduleService.deleteShift(parseInt(id));
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('shift/bulk')
  @ApiOperation({ summary: 'Manager wstawia wiele zmian naraz (Malowanie Pracą)' })
  async createBulkShift(@Body() body: { userId: number, dates: string[], start: string, end: string, roomId?: number }) {
      return this.scheduleService.createBulkShift(body.userId, body.dates, body.start, body.end, body.roomId);
  }

  // =================================================================================================
  // SEKCJJA 3: WNIOSKI URLOPOWE I L4 (MALOWANIE NIEOBECNOŚCIĄ)
  // =================================================================================================

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('request')
  @ApiOperation({ summary: 'Lekarz zgłasza wniosek (pojedynczy zakres)' })
  async createRequest(@Request() req, @Body() body: { type: string, startDate: string, endDate: string, reason?: string }) {
      return this.scheduleService.createRequest(req.user.userId, body.type as AbsenceType, body.startDate, body.endDate, body.reason);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('request/bulk')
  @ApiOperation({ summary: 'Zgłaszanie nieobecności lub dyspozycyjności (Wiele dni)' })
  async createBulkRequest(
      @Request() req, 
      @Body() body: { type: string, dates: string[], reason?: string, startHour?: string, endHour?: string, targetUserId?: number }
  ) {
      // Sprawdzamy czy to Manager
      const isManager = ['MANAGER', 'ADMIN', 'RECEPTIONIST'].includes(req.user.role);
      
      // Jeśli Manager podał targetUserId -> dotyczy tego pracownika.
      const userIdToUse = (isManager && body.targetUserId) ? body.targetUserId : req.user.userId;
      
      // Jeśli Manager tworzy wniosek (np. L4 dla kogoś) -> OD RAZU ZATWIERDZAMY (APPROVED).
      const status: RequestStatus = (isManager && body.targetUserId) ? 'APPROVED' : 'PENDING';

      return this.scheduleService.createBulkRequest(
          userIdToUse, 
          body.type as AbsenceType, 
          body.dates, 
          body.reason, 
          body.startHour, 
          body.endHour,
          status 
      );
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('requests')
  @ApiOperation({ summary: 'Manager pobiera oczekujące wnioski' })
  async getRequests() {
      return this.scheduleService.getPendingRequests();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('requests/:id/resolve')
  @ApiOperation({ summary: 'Manager akceptuje/odrzuca wniosek' })
  async resolveRequest(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED', note?: string }) {
      return this.scheduleService.resolveRequest(parseInt(id), body.status, body.note);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('requests/resolve-all')
  @ApiOperation({ summary: 'Manager akceptuje wszystkie oczekujące wnioski naraz' })
  async resolveAllRequests() {
      return this.scheduleService.resolveAllRequests();
  }

  // =================================================================================================
  // SEKCJJA 4: CORE GRAFIK (GENEROWANIE, ODCZYT, PUBLIKACJA)
  // =================================================================================================

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('generate')
  @ApiOperation({ summary: 'Wygeneruj grafik z szablonów' })
  async generate(@Body() body: { year: number, month: number, userId?: number }) {
    return this.scheduleService.generateMonthSchedule(body.year, body.month, body.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('')
  @ApiOperation({ summary: 'Pobierz grafik (zakres dat)' })
  async getSchedule(
      @Query('from') from: string, 
      @Query('to') to: string,
      @Query('userId') userId?: string,
      @Request() req?
  ) {
      // Jeśli to lekarz/zwykły user, pokaż tylko PUBLISHED. Jeśli Manager - pokaż wszystko (Drafty też).
      const isManager = req.user?.role === 'MANAGER' || req.user?.role === 'ADMIN' || req.user?.role === 'RECEPTIONIST'; 
      return this.scheduleService.getSchedule(from, to, userId ? parseInt(userId) : undefined, !isManager);
  }
  
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('publish')
  @ApiOperation({ summary: 'Zatwierdź zmiany (DRAFT -> PUBLISHED)' })
  async publish(@Body() body: { ids: number[] }) {
      return this.scheduleService.publishSchedule(body.ids);
  }
}