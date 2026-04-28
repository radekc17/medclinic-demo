import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // --- MAIL STARTOWY (Tylko informacja, brak przycisku potwierdzenia) ---
  async sendNewVisitEmail(to: string, patientName: string, appointmentId: number, dateStr: string, doctorName: string) {
    const ticketNumber = `W-${String(appointmentId).padStart(3, '0')}`;

    const mailOptions = {
      from: `"MedClinic System" <${process.env.MAIL_USER}>`,
      to,
      subject: '✅ Potwierdzenie rezerwacji wizyty',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
          <h2 style="color: #2563eb; text-align: center; margin-top: 0;">Witaj ${patientName}!</h2>
          <p style="font-size: 1.1rem; color: #1e293b; text-align: center;">Twoja wizyta została pomyślnie zarezerwowana.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; font-size: 1.1rem; color: #1e293b; margin: 20px 0; border: 1px solid #cbd5e1;">
            <p style="margin: 5px 0;">👨‍⚕️ <strong>Specjalista:</strong> ${doctorName}</p>
            <p style="margin: 5px 0;">📅 <strong>Termin:</strong> ${dateStr}</p>
          </div>

          <div style="text-align: center; background: #eff6ff; border: 2px dashed #bfdbfe; padding: 20px; border-radius: 12px; margin: 30px 0;">
            <p style="margin: 0; color: #64748b; font-size: 0.9rem; text-transform: uppercase; font-weight: bold;">Twój numerek do gabinetu</p>
            <p style="margin: 10px 0 0 0; font-size: 3.5rem; font-weight: 900; color: #2563eb; letter-spacing: 2px;">${ticketNumber}</p>
            <p style="margin: 10px 0 0 0; color: #3b82f6; font-size: 0.85rem;">Numer ten wyświetli się na ekranie w poczekalni.</p>
          </div>

          <p style="font-size: 0.85rem; color: #64748b; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            W razie pytań lub chęci odwołania wizyty, prosimy o kontakt z recepcją.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ E-mail (Nowa Wizyta informacyjna) wysłany do: ${to}`);
    } catch (err) {
      this.logger.error(`❌ Błąd podczas wysyłki e-maila: ${err.message}`);
    }
  }

  // --- MAIL Z PRZYPOMNIENIEM (Wysyłany przez CRON 48h przed wizytą z linkiem weryfikacyjnym) ---
  async sendConfirmationEmail(to: string, patientName: string, appointmentId: number, dateStr: string, token: string) {
    const backendUrl = process.env.BACKEND_URL || 'https://medclinic-demo.onrender.com';
    const confirmLink = `${backendUrl}/appointments/confirm-link/${token}`;

    const mailOptions = {
      from: `"MedClinic System" <${process.env.MAIL_USER}>`,
      to,
      subject: '📌 Prośba o potwierdzenie Twojej wizyty',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
          <h2 style="color: #2563eb; text-align: center;">Witaj ${patientName}!</h2>
          <p style="font-size: 1.1rem; color: #1e293b;">Przypominamy o wizycie w naszym centrum zaplanowanej na:</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; font-size: 1.3rem; font-weight: bold; color: #1e293b; margin: 20px 0; border: 1px solid #cbd5e1;">
            📅 ${dateStr}
          </div>

          <p style="color: #475569; line-height: 1.6;">Abyśmy mogli w pełni przygotować gabinet na Twój przyjazd, prosimy o potwierdzenie obecności jednym kliknięciem poniżej:</p>
          
          <a href="${confirmLink}" style="display: block; width: 220px; margin: 30px auto; padding: 15px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center; font-size: 1rem; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.3);">
            POTWIERDZAM WIZYTĘ
          </a>

          <p style="font-size: 0.85rem; color: #64748b; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 30px;">
            Jeśli nie możesz się pojawić, prosimy o kontakt telefoniczny z recepcją w celu zmiany terminu.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ E-mail (Potwierdzenie CRON) wysłany do: ${to}`);
    } catch (err) {
      this.logger.error(`❌ Błąd podczas wysyłki e-maila (Potwierdzenie): ${err.message}`);
    }
  }
}