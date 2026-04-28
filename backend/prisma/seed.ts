import { PrismaClient, Role, ShiftType, ScheduleStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Rozpoczynam pełne seedowanie bazy danych (Testy TV + Automat Mailowy)...');

  // 1. CZYSZCZENIE BAZY
  await prisma.settings.deleteMany(); 
  await prisma.workLog.deleteMany();
  await prisma.scheduleRequest.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.scheduleTemplate.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.room.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.user.deleteMany();

  // Hasło dla wszystkich kont: "test"
  const passwordTest = await bcrypt.hash('test', 10);

  // --- 2. KLINIKI ---
  const clinicWaw = await prisma.clinic.create({
    data: { name: 'MedClinic Centrala', address: 'ul. Zdrowa 15, 00-123 Warszawa', phone: '+48 22 111 22 33', email: 'warszawa@medclinic.pl' }
  });
  const clinicGda = await prisma.clinic.create({
    data: { name: 'MedClinic Północ', address: 'ul. Morska 5, 80-001 Gdańsk', phone: '+48 58 222 33 44', email: 'gdansk@medclinic.pl' }
  });
  const clinicKrk = await prisma.clinic.create({
    data: { name: 'MedClinic Południe', address: 'ul. Wawelska 1, 30-001 Kraków', phone: '+48 12 333 44 55', email: 'krakow@medclinic.pl' }
  });

  // --- GABINETY ---
  const roomW1 = await prisma.room.create({ data: { name: 'Gabinet 101 (Internista)', type: 'Konsultacyjny', clinicId: clinicWaw.id } });
  const roomW2 = await prisma.room.create({ data: { name: 'Gabinet 102 (Zabiegowy)', type: 'Zabiegowy', clinicId: clinicWaw.id } });
  const roomW3 = await prisma.room.create({ data: { name: 'Gabinet 103 (Chirurgia)', type: 'Specjalistyczny', clinicId: clinicWaw.id } });
  const roomG1 = await prisma.room.create({ data: { name: 'Gabinet G1 (Kardiolog)', type: 'Konsultacyjny', clinicId: clinicGda.id } });
  const roomG2 = await prisma.room.create({ data: { name: 'Gabinet G2 (Zabiegowy)', type: 'Zabiegowy', clinicId: clinicGda.id } });
  const roomG3 = await prisma.room.create({ data: { name: 'Gabinet USG', type: 'Specjalistyczny', clinicId: clinicGda.id } });
  const roomK1 = await prisma.room.create({ data: { name: 'Gabinet K1 (Neurolog)', type: 'Konsultacyjny', clinicId: clinicKrk.id } });
  const roomK2 = await prisma.room.create({ data: { name: 'Gabinet K2 (Zabiegowy)', type: 'Zabiegowy', clinicId: clinicKrk.id } });
  const roomK3 = await prisma.room.create({ data: { name: 'Gabinet K3 (Pediatra)', type: 'Specjalistyczny', clinicId: clinicKrk.id } });

  // --- 3. USTAWIENIA SYSTEMOWE ---
  await prisma.settings.create({
    data: { id: 1, longTermSmsHours: 48, shortTermSmsHours: 2, lastMinuteLimitHours: 2, isTvModuleActive: true, skipManualVerification: false }
  });

  // --- 4. UŻYTKOWNICY ---
  await prisma.user.create({
    data: { email: 'admin@med.pl', password: passwordTest, name: 'Główny Administrator', role: Role.ADMIN, phone: '+48777888999', clinicId: null }
  });

  const myTestUser = await prisma.user.create({
    data: { email: 'radekc17@gmail.com', password: passwordTest, name: 'Radek Testowy', role: Role.PATIENT, pesel: '85010111111', phone: '+48530007724' }
  });

  await prisma.user.create({
    data: { email: 'manager@med.pl', password: passwordTest, name: 'Anna Kadrowa (Manager)', role: Role.MANAGER, phone: '+48999000111', clinicId: null }
  });

  await prisma.user.create({
    data: { email: 'recepcja@med.pl', password: passwordTest, name: 'Pani Halinka (Recepcja)', role: Role.RECEPTIONIST, phone: '+48000111222', clinicId: clinicWaw.id }
  });

  const patientUser = await prisma.user.create({
    data: { email: 'pacjent@med.pl', password: passwordTest, name: 'Adam Pacjent', role: Role.PATIENT, pesel: '90010112345', phone: '+48500600700' }
  });

  // --- 5. LEKARZE ---
  const availDays = [1, 2, 3, 4, 5].map(day => ({ dayOfWeek: day, startTime: '08:00', endTime: '16:00' }));

  const docUser1 = await prisma.user.create({ data: { email: 'test@med.pl', password: passwordTest, name: 'Lek. Jan Testowy', role: Role.DOCTOR, phone: '999888777', pesel: '11111111111' } });
  const docProf1 = await prisma.doctor.create({
    data: { userId: docUser1.id, clinicId: clinicWaw.id, specialization: 'Internista', workStatus: 'AVAILABLE', photoUrl: '/lekarz1.png', availabilities: { create: availDays },
      services: { create: [{ name: 'Konsultacja Podstawowa', price: 150, duration: 20 }] }
    }, include: { services: true }
  });

  const docUser2 = await prisma.user.create({ data: { email: 'anna@med.pl', password: passwordTest, name: 'Lek. Anna Oczna', role: Role.DOCTOR, phone: '111111112', pesel: '11111111112' } });
  const docProf2 = await prisma.doctor.create({
    data: { userId: docUser2.id, clinicId: clinicWaw.id, specialization: 'Okulista', workStatus: 'AVAILABLE', photoUrl: '/lekarka1.jpg', availabilities: { create: availDays },
      services: { create: [{ name: 'Badanie Wzroku', price: 180, duration: 20 }] }
    }, include: { services: true }
  });

  const docUser3 = await prisma.user.create({ data: { email: 'piotr@med.pl', password: passwordTest, name: 'Lek. Piotr Chirurg', role: Role.DOCTOR, phone: '111111113', pesel: '11111111113' } });
  const docProf3 = await prisma.doctor.create({
    data: { userId: docUser3.id, clinicId: clinicWaw.id, specialization: 'Chirurg', workStatus: 'AVAILABLE', photoUrl: '/lekarz2.jpg', availabilities: { create: availDays },
      services: { create: [{ name: 'Konsultacja Chirurgiczna', price: 200, duration: 30 }] }
    }, include: { services: true }
  });

  const docUser4 = await prisma.user.create({ data: { email: 'maria@med.pl', password: passwordTest, name: 'Lek. Maria Specjalistyczna', role: Role.DOCTOR, phone: '555444333', pesel: '22222222222' } });
  const docProf4 = await prisma.doctor.create({
    data: { userId: docUser4.id, clinicId: clinicGda.id, specialization: 'Kardiolog', workStatus: 'AVAILABLE', photoUrl: '/lekarka2.jpg', availabilities: { create: availDays },
      services: { create: [{ name: 'Konsultacja Kardiologiczna', price: 250, duration: 30 }] }
    }, include: { services: true }
  });

  const docUser5 = await prisma.user.create({ data: { email: 'kamil@med.pl', password: passwordTest, name: 'Lek. Kamil Kostny', role: Role.DOCTOR, phone: '222222223', pesel: '22222222223' } });
  const docProf5 = await prisma.doctor.create({
    data: { userId: docUser5.id, clinicId: clinicGda.id, specialization: 'Ortopeda', workStatus: 'AVAILABLE', photoUrl: '/lekarz3.jpg', availabilities: { create: availDays },
      services: { create: [{ name: 'Badanie Układu Ruchu', price: 190, duration: 20 }] }
    }, include: { services: true }
  });

  const docUser6 = await prisma.user.create({ data: { email: 'ewa@med.pl', password: passwordTest, name: 'Lek. Ewa Skórna', role: Role.DOCTOR, phone: '222222224', pesel: '22222222224' } });
  const docProf6 = await prisma.doctor.create({
    data: { userId: docUser6.id, clinicId: clinicGda.id, specialization: 'Dermatolog', workStatus: 'AVAILABLE', photoUrl: '/lekarka3.jpg', availabilities: { create: availDays },
      services: { create: [{ name: 'Ocena Znamion', price: 160, duration: 20 }] }
    }, include: { services: true }
  });

  const docUser7 = await prisma.user.create({ data: { email: 'michal@med.pl', password: passwordTest, name: 'Lek. Michał Nerwowy', role: Role.DOCTOR, phone: '333333331', pesel: '33333333331' } });
  const docProf7 = await prisma.doctor.create({
    data: { userId: docUser7.id, clinicId: clinicKrk.id, specialization: 'Neurolog', workStatus: 'AVAILABLE', photoUrl: '/lekarz4.png', availabilities: { create: availDays },
      services: { create: [{ name: 'Badanie Neurologiczne', price: 220, duration: 30 }] }
    }, include: { services: true }
  });

  const docUser8 = await prisma.user.create({ data: { email: 'zofia@med.pl', password: passwordTest, name: 'Lek. Zofia Dziecięca', role: Role.DOCTOR, phone: '333333332', pesel: '33333333332' } });
  const docProf8 = await prisma.doctor.create({
    data: { userId: docUser8.id, clinicId: clinicKrk.id, specialization: 'Pediatra', workStatus: 'AVAILABLE', photoUrl: '/lekarka4.png', availabilities: { create: availDays },
      services: { create: [{ name: 'Bilans Zdrowia Dziecka', price: 150, duration: 20 }] }
    }, include: { services: true }
  });

  const docUser9 = await prisma.user.create({ data: { email: 'marek@med.pl', password: passwordTest, name: 'Lek. Marek Zębowy', role: Role.DOCTOR, phone: '333333333', pesel: '33333333333' } });
  const docProf9 = await prisma.doctor.create({
    data: { userId: docUser9.id, clinicId: clinicKrk.id, specialization: 'Stomatolog', workStatus: 'AVAILABLE', photoUrl: '/lekarz5.jpg', availabilities: { create: availDays },
      services: { create: [{ name: 'Przegląd Stomatologiczny', price: 100, duration: 20 }] }
    }, include: { services: true }
  });

  // --- 6. SZABLONY GRAFIKU ---
  const validFrom = new Date();
  const doctorsList = [
    { uId: docUser1.id, rId: roomW1.id }, { uId: docUser2.id, rId: roomW2.id }, { uId: docUser3.id, rId: roomW3.id },
    { uId: docUser4.id, rId: roomG1.id }, { uId: docUser5.id, rId: roomG2.id }, { uId: docUser6.id, rId: roomG3.id },
    { uId: docUser7.id, rId: roomK1.id }, { uId: docUser8.id, rId: roomK2.id }, { uId: docUser9.id, rId: roomK3.id }
  ];

  for (const doc of doctorsList) {
    for (let day = 1; day <= 5; day++) {
      await prisma.scheduleTemplate.create({
        data: { userId: doc.uId, dayOfWeek: day, startTime: '08:00', endTime: '16:00', roomId: doc.rId, validFrom }
      });
    }
  }

  // --- 7. WIZYTY USTAWIANE DYNAMICZNIE ---
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const apptToday1 = new Date(today); apptToday1.setHours(14, 45);
  await prisma.appointment.create({ data: { doctorId: docProf1.id, patientId: patientUser.id, serviceId: (docProf1 as any).services[0].id, date: apptToday1, status: 'PENDING' } });

  const apptToday2 = new Date(today); apptToday2.setHours(15, 30);
  await prisma.appointment.create({ data: { doctorId: docProf2.id, guestName: 'Janek Dzisiejszy', guestPhone: '555111222', serviceId: (docProf2 as any).services[0].id, date: apptToday2, status: 'PENDING' } });

  const apptTest = new Date(tomorrow); apptTest.setHours(15, 10);
  await prisma.appointment.create({ 
    data: { 
      doctorId: docProf1.id, 
      patientId: myTestUser.id, 
      serviceId: (docProf1 as any).services[0].id, 
      date: apptTest, 
      status: 'PENDING',
      confirmationToken: 'test-token-radek-123'
    } 
  });

  const appt2 = new Date(tomorrow); appt2.setHours(9, 30);
  await prisma.appointment.create({ data: { doctorId: docProf2.id, patientId: patientUser.id, serviceId: (docProf2 as any).services[0].id, date: appt2, status: 'PENDING' } });

  const appt3 = new Date(tomorrow); appt3.setHours(11, 0);
  await prisma.appointment.create({ data: { doctorId: docProf3.id, guestName: 'Warszawski Gość', guestPhone: '111222333', serviceId: (docProf3 as any).services[0].id, date: appt3, status: 'PENDING' } });

  const appt4 = new Date(tomorrow); appt4.setHours(9, 0);
  await prisma.appointment.create({ data: { doctorId: docProf4.id, guestName: 'Zofia Kardiologiczna', guestPhone: '555666777', serviceId: (docProf4 as any).services[0].id, date: appt4, status: 'PENDING' } });

  const appt5 = new Date(tomorrow); appt5.setHours(10, 15);
  await prisma.appointment.create({ data: { doctorId: docProf5.id, patientId: myTestUser.id, serviceId: (docProf5 as any).services[0].id, date: appt5, status: 'PENDING' } });

  const appt6 = new Date(tomorrow); appt6.setHours(12, 0);
  await prisma.appointment.create({ data: { doctorId: docProf7.id, patientId: patientUser.id, serviceId: (docProf7 as any).services[0].id, date: appt6, status: 'PENDING' } });

  console.log(`✅ Baza zasilona!`);

  // --- 8. GENEROWANIE GRAFIKU ---
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const shiftsToCreate: any[] = [];
  for (const doc of doctorsList) {
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateStr = d.toISOString().split('T')[0];
        shiftsToCreate.push({
          userId: doc.uId,
          roomId: doc.rId,
          date: new Date(d),
          startTime: new Date(`${dateStr}T08:00:00.000Z`),
          endTime: new Date(`${dateStr}T16:00:00.000Z`),
          type: ShiftType.WORK,
          status: ScheduleStatus.PUBLISHED
        });
      }
    }
  }
  await prisma.workSchedule.createMany({ data: shiftsToCreate });
  console.log(`📅 Wygenerowano grafik pracy.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });