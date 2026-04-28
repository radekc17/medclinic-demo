import React from 'react';
import { translations, type Language } from '../translations'; 

interface Props {
  lang: Language;
  onBookClick: () => void;
  clinicData?: any; 
  allClinics?: any[]; 
  onClinicSelect?: (clinicId: number) => void;
}

const pageContent = {
  PL: {
    heroTitle: 'Zadbaj o swoje zdrowie',
    heroHighlight: 'na poważnie',
    heroSubtitle: 'Gwarantujemy profesjonalną opiekę, najnowocześniejszy sprzęt i brak stresu w poczekalni.',
    servingTitle: 'Budujemy uśmiechy od',
    servingDesc: 'Wierzymy, że wizyta u lekarza nie musi kojarzyć się ze stresem i długim czekaniem. Nasz autorski system Smart-Wait gwarantuje, że wejdziesz do gabinetu dokładnie o swoim czasie.',
    priceBtn: 'ZOBACZ CENNIK USŁUG →',
    offerTag: 'Zadbaj o swoje zdrowie',
    offerTitle: 'Co nasza klinika',
    offerHighlight: 'oferuje',
    tvTitle: 'Twoja poczekalnia Premium.',
    tvDesc: 'Otrzymujesz unikalny numerek zanonimizowany w mailu. Na ekranie w poczekalni zawsze widzisz, kiedy jest Twoja kolej. Poczuj spokój.',
    programTitle: 'Nasz program',
    programHighlight: 'opieki',
    p1: 'Regularne przeglądy i wizyty kontrolne',
    p2: 'Zaawansowana opieka diagnostyczna',
    p3: 'Estetyka i leczenie zachowawcze',
    p4: 'Pełna diagnostyka obrazowa i USG na miejscu',
    p5: 'Leczenie specjalistyczne i bezbolesne',
    footerTitle: 'Dziś jest dzień, by umówić',
    footerHighlight: 'wizytę',
    footerDesc: 'Klinika jest czynna w godzinach dostosowanych do Państwa potrzeb. Posiadamy darmowy parking.',
  },
  EN: {
    heroTitle: 'Take your health',
    heroHighlight: 'seriously',
    heroSubtitle: 'We guarantee professional care, modern equipment, and a stress-free waiting room.',
    servingTitle: 'Serving smiles since',
    servingDesc: 'We believe a doctor\'s visit shouldn\'t be associated with stress and long waits. Our custom Smart-Wait system ensures you enter the office exactly on time.',
    priceBtn: 'SEE PRICING →',
    offerTag: 'Take care of your health',
    offerTitle: 'What our clinic has',
    offerHighlight: 'to offer',
    tvTitle: 'Your Premium Waiting Room.',
    tvDesc: 'You receive a unique, anonymized number via email. You can always see when it\'s your turn on the waiting room screen. Feel at peace.',
    programTitle: 'Our care',
    programHighlight: 'program',
    p1: 'Regular check-ups and visits',
    p2: 'Advanced diagnostic care',
    p3: 'Aesthetics and conservative treatment',
    p4: 'Full imaging diagnostics and ultrasound on site',
    p5: 'Specialized and painless treatment',
    footerTitle: 'Today is the day to book',
    footerHighlight: 'an appointment',
    footerDesc: 'The clinic is open at times adapted to your needs. We provide free parking.',
  },
  UA: {
    heroTitle: 'Подбайте про своє здоров\'я',
    heroHighlight: 'серйозно',
    heroSubtitle: 'Ми гарантуємо професійний догляд, сучасне обладнання та відсутність стресу в залі очікування.',
    servingTitle: 'Створюємо посмішки з',
    servingDesc: 'Ми віримо, що візит до лікаря не повинен асоціюватися зі стресом. Наша система Smart-Wait гарантує, що ви зайдете в кабінет вчасно.',
    priceBtn: 'ПЕРЕГЛЯНУТИ ЦІНИ →',
    offerTag: 'Подбайте про своє здоров\'я',
    offerTitle: 'Що пропонує наша',
    offerHighlight: 'клініка',
    tvTitle: 'Ваша преміум кімната очікування.',
    tvDesc: 'Ви отримуєте унікальний анонімний номер на email. Ви завжди бачите, коли ваша черга, на екрані. Відчуйте спокій.',
    programTitle: 'Наша програма',
    programHighlight: 'догляду',
    p1: 'Регулярні огляди та візити',
    p2: 'Передова діагностична допомога',
    p3: 'Естетика та консервативне лікування',
    p4: 'Повна візуальна діагностика на місці',
    p5: 'Спеціалізоване лікування',
    footerTitle: 'Сьогодні день, щоб записатися',
    footerHighlight: 'на прийом',
    footerDesc: 'Клініка працює в години, адаптовані до ваших потреб. У нас є безкоштовна парковка.',
  }
};

export function HomePage({ lang, onBookClick, clinicData, allClinics = [], onClinicSelect }: Props) {
  const t = translations[lang];
  const c = pageContent[lang] || pageContent['PL'];

  const offering = [
    { title: t.specDentist, desc: t.descDentist },
    { title: t.specPediatry, desc: t.descPediatry },
    { title: t.specNeuro, desc: t.descNeuro },
    { title: t.specCardio, desc: t.descCardio },
  ];

  // Widok wyboru kliniki (Strona główna bez wybranej placówki)
  if (!clinicData) {
    return (
      <div style={{background: 'white', color: '#0f172a', fontFamily: '"Open Sauce", sans-serif'}}>
        <section className="hero-section" style={{...styles.heroFull, backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.5)), url('/clinic_interior.jpg')`}}>
          <div style={styles.heroContentCentered} className="hero-content">
            <span style={styles.heroTag}>MedClinic</span>
            <h1 className="hero-title" style={styles.heroTitleCentered}>{c.heroTitle} <br/><span style={{color: '#facc15'}}>{c.heroHighlight}</span>.</h1>
            <p className="hero-subtitle" style={styles.heroTextCentered}>{c.heroSubtitle}</p>
            <div style={{marginTop: '30px'}}>
              <button onClick={onBookClick} style={styles.btnSolidWhite}>{t.bookBtn}</button>
            </div>
          </div>
        </section>

        <section style={{padding: '100px 5vw', background: '#f8fafc', textAlign: 'center'}} className="locations-section">
          <h2 className="section-title" style={styles.sectionTitleCenter}>Nasze <span style={{color: '#2563eb'}}>Lokalizacje</span></h2>
          <div className="offering-grid" style={{...styles.offeringGrid, gap: '40px'}}>
            {allClinics.map((clinic, i) => (
              <button 
                key={i} 
                onClick={() => onClinicSelect && onClinicSelect(clinic.id)}
                style={{
                  ...styles.offeringCard, 
                  padding: 0, 
                  overflow: 'hidden', 
                  border: 'none', 
                  background: 'white', 
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{height: '200px', background: '#e2e8f0', backgroundImage: `url('/services_equipment.jpg')`, backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                <div style={{padding: '30px'}}>
                  <h3 style={styles.cardTitle}>{clinic.name}</h3>
                  <p style={{color: '#475569', marginBottom: '10px'}}>📍 {clinic.address}</p>
                  <p style={{color: '#2563eb', fontWeight: 'bold'}}>📞 {clinic.phone}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Widok konkretnej kliniki
  const mapQuery = encodeURIComponent(`${clinicData.name} ${clinicData.address}`);
  const mapUrl = `https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div style={{background: 'white', color: '#0f172a', fontFamily: '"Open Sauce", sans-serif'}}>
      
      <section className="hero-section" style={{...styles.heroFull, backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.4)), url('/hero_dental.png')`}}>
        <div style={styles.heroContentCentered} className="hero-content">
          <span style={styles.heroTag}>MedClinic: {clinicData.name}</span>
          <h1 className="hero-title" style={styles.heroTitleCentered}>{c.heroTitle} <br/><span style={{color: '#facc15'}}>{c.heroHighlight}</span>.</h1>
          <p className="hero-subtitle" style={styles.heroTextCentered}>{c.heroSubtitle}</p>
          <div style={{marginTop: '30px'}}>
            <button onClick={onBookClick} style={styles.btnSolidWhite}>{t.bookBtn}</button>
          </div>
        </div>
      </section>

      {/* KLUCZOWA ZMIANA: Zdjęcie na mobile pójdzie na górę dzięki flex-direction w App.css */}
      <section className="split-section" style={styles.splitSection}>
        <div className="split-text" style={styles.splitTextContent}>
          <h2 className="section-title-left" style={styles.sectionTitleLeft}>{c.servingTitle}<br/><span style={{color: '#2563eb'}}>2001</span>.</h2>
          <p className="split-paragraph" style={styles.paragraph}>{c.servingDesc}</p>
          <button onClick={onBookClick} style={styles.linkArrow}>{c.priceBtn}</button>
        </div>
        <div className="split-img" style={{...styles.splitImage, backgroundImage: `url('/woman_smile.jpg')`}}></div>
      </section>

      <section className="offering-section" style={styles.offeringSection}>
        <span style={styles.offeringTag}>{c.offerTag}</span>
        <h2 className="section-title" style={styles.sectionTitleCenter}>{c.offerTitle} <br/><span style={{color: '#2563eb'}}>{c.offerHighlight}</span></h2>
        <div className="offering-grid" style={styles.offeringGrid}>
          {offering.map((item, i) => {
            // Sprawdzamy czy to kardiolog (ignorujemy wielkość liter i spacje)
            const isCardio = item.title.toLowerCase().trim() === t.specCardio.toLowerCase().trim();

            return (
              <div 
                key={i} 
                style={{
                  ...styles.offeringCard, 
                  cursor: isCardio ? 'pointer' : 'default',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => {
                  if (isCardio) {
                    window.open('https://music.youtube.com/watch?v=pIb7QoXdP_k', '_blank');
                  }
                }}
                onMouseOver={(e) => {
                   if(isCardio) e.currentTarget.style.borderColor = '#2563eb';
                }}
                onMouseOut={(e) => {
                   if(isCardio) e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={styles.cardIcon}>
                  {item.title.toLowerCase().includes('stom') ? '🦷' : 
                   item.title.toLowerCase().includes('pedi') ? '🧸' : 
                   item.title.toLowerCase().includes('neur') ? '🧠' : '🩺'}
                </div>
                <h3 style={styles.cardTitle}>{item.title}</h3>
                <p style={styles.cardDesc}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="footer-split" style={{display: 'flex', flexWrap: 'wrap', minHeight: '70vh'}}>
        <div className="map-container" style={{flex: 1, minWidth: '300px', background: '#e2e8f0'}}>
          <iframe 
            src={mapUrl} 
            width="100%" 
            height="100%" 
            style={{border: 0, minHeight: '400px'}} 
            allowFullScreen={false} 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
        
        <div className="footer-content" style={{flex: 1, padding: '8vw 5vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#0f172a', color: 'white'}}>
          <h2 className="section-title-left" style={{...styles.sectionTitleLeft, color: 'white'}}>{c.footerTitle}<br/><span style={{color: '#60a5fa'}}>{c.footerHighlight}</span>.</h2>
          
          <div style={{...styles.contactList, color: '#e2e8f0'}}>
            <div style={styles.contactItem}><span style={{fontSize: '1.5rem'}}>📍</span> {clinicData.address}</div>
            <div style={styles.contactItem}><span style={{fontSize: '1.5rem'}}>📞</span> {clinicData.phone}</div>
            <div style={styles.contactItem}><span style={{fontSize: '1.5rem'}}>📧</span> {clinicData.email}</div>
          </div>

          <p style={{fontSize: '1rem', color: '#94a3b8', marginTop: '40px', fontWeight: 600, lineHeight: 1.6}}>
            {c.footerDesc}
          </p>
          <button onClick={onBookClick} style={{...styles.btnSolidWhite, alignSelf: 'flex-start', marginTop: '30px', background: '#2563eb', color: 'white'}}>{t.bookBtn}</button>
        </div>
      </section>

    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  heroFull: { height: '80vh', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  heroContentCentered: { textAlign: 'center', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  heroTag: { color: 'white', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem', marginBottom: '20px' },
  heroTitleCentered: { fontSize: '4.5rem', fontWeight: 900, color: 'white', margin: '0 0 20px 0', letterSpacing: '-2px', lineHeight: 1.1 },
  heroTextCentered: { fontSize: '1.2rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 },
  btnSolidWhite: { background: 'white', color: '#0f172a', padding: '15px 30px', borderRadius: '30px', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' },
  splitSection: { display: 'flex', minHeight: '80vh', width: '100%', alignItems: 'stretch' },
  splitTextContent: { flex: 1, padding: '10vw 8vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'white' },
  splitImage: { flex: 1, backgroundSize: 'cover', backgroundPosition: 'center' },
  sectionTitleLeft: { fontSize: '3.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', margin: '0 0 30px 0', lineHeight: 1.1 },
  paragraph: { fontSize: '1.1rem', color: '#475569', lineHeight: 1.8, marginBottom: '40px', maxWidth: '500px' },
  linkArrow: { background: 'none', border: 'none', padding: 0, color: '#0f172a', textDecoration: 'none', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' },
  offeringSection: { padding: '120px 5vw', textAlign: 'center', background: '#f8fafc' },
  offeringTag: { fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '1px', marginBottom: '10px', display: 'block' },
  sectionTitleCenter: { fontSize: '3.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', marginBottom: '80px', lineHeight: 1.1 },
  offeringGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px', maxWidth: '1440px', margin: '0 auto' },
  offeringCard: { background: 'white', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'left', transition: 'all 0.2s' },
  cardIcon: { fontSize: '2.5rem', marginBottom: '20px' },
  cardTitle: { fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' },
  cardDesc: { fontSize: '0.95rem', color: '#475569', lineHeight: 1.5 },
  contactList: { display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '1.1rem', color: '#0f172a', fontWeight: 600 },
  contactItem: { display: 'flex', alignItems: 'center', gap: '15px' }
};