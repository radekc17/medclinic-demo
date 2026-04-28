// backend/src/auth/dto/auth.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthDto {
  @ApiProperty({ example: 'nowy@pacjent.pl' })
  email: string;

  @ApiProperty({ example: 'tajnehaslo123' })
  password: string;

  @ApiProperty({ example: 'Jan Kowalski', required: false })
  name?: string;

  @ApiProperty({ example: '123456789', required: false })
  phone?: string;

  @ApiProperty({ example: '90010112345', required: false })
  pesel?: string;
}