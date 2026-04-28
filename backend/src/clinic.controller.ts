// backend/src/clinic.controller.ts
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Clinics')
@Controller('clinics')
export class ClinicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Pobierz listę wszystkich przychodni (Główny Portal)' })
  async getAllClinics() {
    return this.prisma.clinic.findMany({
      orderBy: { id: 'asc' }
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz dane konkretnej przychodni wraz z jej lekarzami' })
  async getClinicDetails(@Param('id') id: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: parseInt(id) },
      include: {
        doctors: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
            services: true,
            clinic: true // Zachowujemy spójność dla frontendu
          }
        }
      }
    });

    if (!clinic) throw new NotFoundException('Klinika nie istnieje');
    return clinic;
  }
}