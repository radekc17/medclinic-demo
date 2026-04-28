import { useState } from 'react';
import { translations, type Language } from '../translations';
import { type Doctor, type Service } from './DoctorsList'; 

interface Props {
  doctors: Doctor[];
  lang: Language;
  onBookDirectly: (doctor: Doctor, service?: Service) => void;
}

export function DoctorsDirectory({ doctors, lang, onBookDirectly }: Props) {
  const t = translations[lang];
  const [selectedProfile, setSelectedProfile] = useState<Doctor | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);

  const getPlaceholderDescription = (spec: string) => {
    return `Specjalista ${spec.toLowerCase()} z wieloletnim doświadczeniem zawodowym. Ekspert w diagnostyce i nowoczesnym leczeniu, stawiający na zindywidualizowane podejście do każdego pacjenta.`;
  };

  const getServiceDescription = (serviceName: string) => {
    return `Szczegółowy opis zabiegu/wizyty: ${serviceName}. Procedura przeprowadzana z najwyższą starannością przy użyciu nowoczesnego sprzętu medycznego. Czas trwania obejmuje wywiad medyczny, badanie oraz zalecenia pozabiegowe.`;
  };

  // --- FUNKCJA POMOCNICZA DO URUCHOMIENIA REZERWACJI ---
  const handleStartBooking = (doc: Doctor, svc?: Service) => {
    // 1. NAJPIERW zamykamy okno profilu (to rozwiązuje Twój problem!)
    setSelectedProfile(null); 
    setExpandedServiceId(null);
    
    // 2. POTEM otwieramy modal rezerwacji z App.tsx
    onBookDirectly(doc, svc);
  };

  return (
    <div style={{padding: '60px 5vw', maxWidth: '1440px', margin: '0 auto'}}>
      <div style={{textAlign: 'center', marginBottom: '60px'}}>
        <h2 style={{fontSize: '3.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px'}}>{t.doctorsTitle}</h2>
        <p style={{color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto'}}>Poznaj nasz zespół i umów konkretny zabieg bezpośrednio z profilu lekarza.</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '40px'}}>
        {doctors.map(doc => (
          <div key={doc.id} onClick={() => setSelectedProfile(doc)} style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}>
            <div style={{
              height: '380px', 
              backgroundImage: `url("${(doc.photoUrl && doc.photoUrl.trim()) || '/receptionist_portrait.jpg'}")`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'top center'
            }}></div>
            <div style={{padding: '30px', textAlign: 'center'}}>
              <h3 style={{margin: '0 0 8px 0', fontSize: '1.6rem', color: '#0f172a', fontWeight: 900}}>{doc.user.name}</h3>
              <p style={{margin: 0, color: '#2563eb', fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase'}}>{doc.specialization}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedProfile && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)'}} onClick={() => { setSelectedProfile(null); setExpandedServiceId(null); }}>
          <div style={{background: 'white', borderRadius: '32px', width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'}} onClick={e => e.stopPropagation()}>
            
            {/* LEWA KOLUMNA */}
            <div style={{flex: '1', background: '#0f172a', padding: '50px', display: 'flex', flexDirection: 'column', color: 'white', minWidth: '350px'}}>
              <div style={{
                width: '100%', height: '350px', borderRadius: '24px', marginBottom: '30px',
                backgroundImage: `url("${(selectedProfile.photoUrl && selectedProfile.photoUrl.trim()) || '/receptionist_portrait.jpg'}")`, 
                backgroundSize: 'cover', backgroundPosition: 'top center'
              }}></div>
              <h2 style={{fontSize: '2.5rem', fontWeight: 900, color: 'white', margin: '0 0 10px 0', letterSpacing: '-1px'}}>{selectedProfile.user.name}</h2>
              <span style={{background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '10px', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.9rem', display: 'inline-block', marginBottom: '30px'}}>{selectedProfile.specialization}</span>
              <p style={{fontSize: '1rem', color: '#94a3b8', marginTop: 'auto'}}>📞 {selectedProfile.user.phone || '+48 22 111 22 33'}</p>
            </div>

            {/* PRAWA KOLUMNA */}
            <div style={{flex: '2', padding: '50px', display: 'flex', flexDirection: 'column', position: 'relative', overflowY: 'auto'}}>
              <button onClick={() => { setSelectedProfile(null); setExpandedServiceId(null); }} style={{position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b'}}>×</button>
              
              <div style={{marginBottom: '30px'}}>
                <h3 style={{fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '15px'}}>O specjaliście</h3>
                <p style={{color: '#475569', lineHeight: 1.6, fontSize: '1rem', margin: 0}}>
                  {getPlaceholderDescription(selectedProfile.specialization)}
                </p>
              </div>

              <h3 style={{fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '15px'}}>Kliknij w usługę, aby zobaczyć opis:</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {selectedProfile.services.map(svc => (
                  <div key={svc.id} style={{border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s'}}>
                    <div 
                      onClick={() => setExpandedServiceId(expandedServiceId === svc.id ? null : svc.id)}
                      style={{display: 'flex', justifyContent: 'space-between', padding: '20px', background: expandedServiceId === svc.id ? '#f8fafc' : 'white', cursor: 'pointer', alignItems: 'center'}}
                    >
                      <div style={{flex: 1}}>
                        <strong style={{display: 'block', color: '#0f172a', fontSize: '1.1rem'}}>{svc.name}</strong>
                        <span style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 600}}>
                          {svc.duration} {t.durationMin} | {svc.isNfz ? t.labelNfz : 'Prywatnie'}
                        </span>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
                        <span style={{fontWeight: 900, color: '#2563eb', fontSize: '1.2rem'}}>{svc.price} PLN</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartBooking(selectedProfile, svc); // UŻYWAMY NOWEJ FUNKCJI
                          }}
                          style={{padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'}}
                        >
                          UMÓW
                        </button>
                      </div>
                    </div>
                    {expandedServiceId === svc.id && (
                      <div style={{padding: '0 20px 20px 20px', background: '#f8fafc', color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5, borderTop: '1px dashed #e2e8f0'}}>
                        <p style={{marginTop: '15px'}}>{getServiceDescription(svc.name)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{marginTop: 'auto', paddingTop: '30px'}}>
                <button 
                  onClick={() => handleStartBooking(selectedProfile)} // UŻYWAMY NOWEJ FUNKCJI
                  style={{ width: '100%', padding: '20px', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Ogólna rezerwacja wizyty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}