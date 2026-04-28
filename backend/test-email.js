// backend/test-email.js
const nodemailer = require('nodemailer');

const TWOJ_GMAIL = 'barwnyskowron2@gmail.com'; 
const TWOJE_HASLO_APLIKACJI = 'lsctivqzfrhawtdv'; 
const ODBIORCA = 'radekc17@gmail.com'; 

async function testMail() {
  console.log('⏳ Próbuję połączyć się z serwerami Google (wymuszam port 587)...');

  // Konfiguracja "Listonosza" z nowymi ustawieniami omijającymi blokady
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,          // ZMIANA: Standardowy port TLS omijający filtry antyspamowe ISP
    secure: false,      // ZMIANA: Dla portu 587 to musi być false (TLS jest startowane później)
    auth: {
      user: TWOJ_GMAIL,
      pass: TWOJE_HASLO_APLIKACJI,
    },
    tls: {
      rejectUnauthorized: false // Ignoruje lokalne błędy certyfikatów (częste przy antywirusach)
    }
  });

  try {
    let info = await transporter.sendMail({
      from: `"MedClinic System" <${TWOJ_GMAIL}>`,
      to: ODBIORCA,
      subject: "🚀 Test z nowego portu MedApp!",
      text: "Port 587 zadziałał!",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #16a34a; border-radius: 10px;">
            <h2 style="color: #16a34a;">Sukces! 🎉</h2>
            <p>Udało się ominąć blokadę sieciową używając portu 587.</p>
        </div>
      `
    });

    console.log('✅ SUKCES! Wiadomość wysłana pomyślnie!');
    console.log('ID Wiadomości:', info.messageId);

  } catch (error) {
    console.error('❌ BŁĄD WYSYŁKI:');
    console.error(error.message);
  }
}

testMail();