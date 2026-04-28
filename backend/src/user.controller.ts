import { Controller, Get, Post, Body, Patch, UseGuards, Request, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';

@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  // --- 1. POBIERANIE WŁASNEGO PROFILU ---
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Pobierz dane zalogowanego użytkownika' })
  async getProfile(@Request() req) {
    const userId = req.user.userId;
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      include: { doctorProfile: true } 
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }

    const { password, ...result } = user;
    return result;
  }

  // --- 2. AKTUALIZACJA WŁASNEGO PROFILU ---
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Edytuj swoje dane' })
  async updateProfile(@Request() req, @Body() body: any) {
    const userId = req.user.userId;
    const updateData: any = {};

    if (body.name) updateData.name = body.name;
    if (body.phone) updateData.phone = body.phone;
    if (body.pesel) updateData.pesel = body.pesel;
    if (body.email) updateData.email = body.email;

    if (body.password && body.password.trim() !== "") {
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { doctorProfile: true }
    });

    const { password, ...result } = updatedUser;
    return result;
  }

  // --- 3. LISTA PERSONELU ---
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('staff')
  @ApiOperation({ summary: 'Pobierz listę personelu' })
  async getStaff() {
    return this.prisma.user.findMany({
      where: {
        role: { in: ['DOCTOR', 'RECEPTIONIST', 'MANAGER', 'ADMIN'] }
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true
      }
    });
  }

  // --- 4. SMART SEARCH PACJENTÓW (DLA RECEPCJI) ---
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('search-patients')
  @ApiOperation({ summary: 'Szukaj pacjentów po nazwisku, PESEL lub telefonie' })
  async searchPatients(@Request() req, @Query('q') query: string) {
    const staffRoles = ['RECEPTIONIST', 'MANAGER', 'ADMIN', 'DOCTOR'];
    if (!staffRoles.includes(req.user.role)) {
       throw new BadRequestException('Brak uprawnień do przeglądania bazy');
    }

    if (!query || query.length < 3) return [];

    return this.prisma.user.findMany({
      where: {
        role: 'PATIENT',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { pesel: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        pesel: true,
        phone: true,
        email: true
      },
      take: 10
    });
  }

  // --- 5. PEŁNA LISTA PACJENTÓW (DLA PANELU KARTOTEKI) ---
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('patients-all')
  @ApiOperation({ summary: 'Pobierz wszystkich pacjentów' })
  async getAllPatients() {
    return this.prisma.user.findMany({
      where: { role: 'PATIENT' },
      select: {
        id: true,
        name: true,
        pesel: true,
        phone: true,
        email: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
  }

  // --- 6. TWORZENIE NOWEGO PACJENTA PRZEZ PERSONEL (NAPRAWA BŁĘDU POST) ---
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post() // Obsługa żądania POST na /users
  @ApiOperation({ summary: 'Dodaj nowego pacjenta do kartoteki' })
  async createPatient(@Request() req, @Body() body: any) {
    // Sprawdzenie uprawnień (tylko personel)
    const staffRoles = ['RECEPTIONIST', 'MANAGER', 'ADMIN'];
    if (!staffRoles.includes(req.user.role)) {
      throw new BadRequestException('Brak uprawnień do dodawania pacjentów');
    }

    // Walidacja unikalności PESEL
    if (body.pesel) {
      const existing = await this.prisma.user.findUnique({ where: { pesel: body.pesel } });
      if (existing) throw new BadRequestException('Pacjent z tym numerem PESEL już istnieje w bazie');
    }

    // Tworzenie rekordu pacjenta
    return this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone,
        pesel: body.pesel,
        role: 'PATIENT',
        // Generujemy losowe hasło, ponieważ pacjent z bazy go jeszcze nie ma
        password: body.password || await bcrypt.hash(Math.random().toString(36), 10),
      },
      select: {
        id: true,
        name: true,
        pesel: true,
        email: true,
        phone: true
      }
    });
  }
}