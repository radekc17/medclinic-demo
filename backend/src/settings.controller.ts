import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Pobierz pełną konfigurację systemu i modułów' })
  async getSettings() {
    // Pobieramy rekord o ID 1 (stworzony przez seed)
    let settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    
    // Zabezpieczenie: jeśli z jakiegoś powodu zniknął, stwórz domyślny z nowymi polami
    if (!settings) {
      settings = await this.prisma.settings.create({
        data: { 
          id: 1, 
          longTermSmsHours: 48, 
          shortTermSmsHours: 2, 
          lastMinuteLimitHours: 2,
          isTvModuleActive: false, // Domyślnie wyłączony
          skipManualVerification: false 
        }
      });
    }
    return settings;
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch()
  @ApiOperation({ summary: 'Aktualizuj czasy powiadomień oraz statusy modułów' })
  async updateSettings(@Body() body: any) {
    // Pozwalamy aktualizować pola SMS oraz przełączniki modułów opcjonalnych
    return this.prisma.settings.update({
      where: { id: 1 },
      data: {
        // Logika czasów (ORYGINALNA)
        longTermSmsHours: body.longTermSmsHours !== undefined ? body.longTermSmsHours : undefined,
        shortTermSmsHours: body.shortTermSmsHours !== undefined ? body.shortTermSmsHours : undefined,
        lastMinuteLimitHours: body.lastMinuteLimitHours !== undefined ? body.lastMinuteLimitHours : undefined,
        
        // Logika modułów (DODANA)
        isTvModuleActive: body.isTvModuleActive !== undefined ? body.isTvModuleActive : undefined,
        skipManualVerification: body.skipManualVerification !== undefined ? body.skipManualVerification : undefined
      }
    });
  }
}