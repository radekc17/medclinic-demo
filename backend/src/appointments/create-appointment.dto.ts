// backend/src/appointments/create-appointment.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty()
  doctorId: number;

  @ApiProperty()
  date: string;

  // Pola opcjonalne (dla Gościa)
  @ApiProperty({ required: false })
  patientId?: number; // Jeśli zalogowany

  @ApiProperty({ required: false })
  guestName?: string;

  @ApiProperty({ required: false })
  guestEmail?: string;

  @ApiProperty({ required: false })
  guestPhone?: string;

  @ApiProperty({ required: false, description: 'PESEL do identyfikacji pacjenta' })
  guestPesel?: string;
}