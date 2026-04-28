// backend/src/staff.controller.ts
import { Controller, Get, Post, Patch, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';

@ApiTags('Staff Management')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Pobierz cały personel (bez pacjentów)' })
  async getStaff() {
    return this.prisma.user.findMany({
      where: { role: { not: 'PATIENT' } },
      include: { 
        clinic: true,
        // Używamy doctorProfile - nazwa musi być identyczna jak w schema.prisma
        doctorProfile: true 
      },
      orderBy: { role: 'asc' }
    });
  }

  @Post()
  @ApiOperation({ summary: 'Utwórz nowe konto personelu' })
  async createStaff(@Body() body: any) {
    const { email, password, name, role, clinicId } = body;
    
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Ten email jest już przypisany do innego konta!');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Solidne parsowanie clinicId
    const parsedClinicId = (clinicId === "" || clinicId === null || clinicId === undefined) 
      ? null 
      : Number(clinicId);
    
    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
          clinicId: parsedClinicId
        }
      });

      // Jeśli tworzymy lekarza, od razu tworzymy rekord w tabeli Doctor
      if (role === 'DOCTOR') {
        await tx.doctor.create({
          data: {
            userId: newUser.id,
            specialization: 'Do uzupełnienia',
            clinicId: parsedClinicId // Synchronizacja przy tworzeniu
          }
        });
      }

      return newUser;
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Zaktualizuj rolę lub klinikę pracownika' })
  async updateStaff(@Param('id') id: string, @Body() body: any) {
    const { role, clinicId } = body;
    const userId = parseInt(id);

    // Kluczowe: Parsowanie clinicId, aby obsłużyć null, puste stringi i liczby
    const parsedClinicId = clinicId !== undefined 
      ? (clinicId === "" || clinicId === null ? null : Number(clinicId)) 
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      // 1. Aktualizacja w głównej tabeli User (dane konta)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { 
          role: role !== undefined ? role : undefined, 
          clinicId: parsedClinicId
        },
        include: { doctorProfile: true }
      });

      // 2. SYNCHRONIZACJA Z TABELĄ DOCTOR
      // Szukamy rekordu w tabeli Doctor po userId
      const doctorRecord = await tx.doctor.findUnique({
        where: { userId: userId }
      });

      if (doctorRecord) {
        // Jeśli lekarz istnieje, aktualizujemy mu placówkę w jego profilu
        await tx.doctor.update({
          where: { userId: userId },
          data: { 
            clinicId: parsedClinicId 
          }
        });
      } else if (updatedUser.role === 'DOCTOR') {
        // Jeśli użytkownik zmienił rolę na lekarza, a nie miał profilu - tworzymy go
        await tx.doctor.create({
          data: {
            userId: userId,
            specialization: 'Specjalista',
            clinicId: parsedClinicId
          }
        });
      }

      return updatedUser;
    });
  }
}