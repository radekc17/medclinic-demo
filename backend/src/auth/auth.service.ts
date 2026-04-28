// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async register(dto: AuthDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) throw new BadRequestException('Ten email jest już zajęty!');

    // Sprawdź czy PESEL nie jest zajęty (jeśli podano)
    if (dto.pesel) {
      const existingPesel = await this.prisma.user.findUnique({
         where: { pesel: dto.pesel } 
      });
      if (existingPesel) throw new BadRequestException('Ten PESEL jest już w bazie!');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name || 'Użytkownik',
        phone: dto.phone,
        pesel: dto.pesel
      },
    });

    return { message: 'Rejestracja udana', userId: user.id };
  }

  async login(dto: AuthDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Błędny email lub hasło');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pesel: user.pesel,
        phone: user.phone, // <--- Zwracamy telefon
        role: user.role
      }
    };
  }
}