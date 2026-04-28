import { useState, useMemo } from 'react';
import { translations, type Language } from '../translations';

export interface Service {
  id: number;
  name: string;
  price: string;
  duration: number;
  isNfz: boolean;
}

export interface Doctor {
  id: number;
  specialization: string;
  photoUrl?: string | null;
  services: Service[];
  user: { 
    name: string; 
    email: string;
    phone?: string;
  };
}

interface Props {
  doctors: Doctor[];
  loading: boolean;
  lang: Language;
  onBook: (doctor: Doctor) => void;
}

export function DoctorsList({ doctors, loading, lang, onBook }: Props) {
  const t = translations[lang];

  // STANY DLA FILTRÓW
  const [filterSpec, setFilterSpec] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Rozszerzona mapa specjalizacji zgodna z Twoim seedem
  const getLocalizedSpec = (dbSpec: string) => {
    const lower = dbSpec.toLowerCase();
    if (lower.includes('kardio')) return t.specCardio || "Kardiolog";
    if (lower.includes('stomat') || lower.includes('dent')) return t.specDentist || "Stomatolog";
    if (lower.includes('neuro')) return t.specNeuro || "Neurolog";
    if (lower.includes('pedia')) return t.specPediatry || "Pediatra";
    if (lower.includes('intern')) return t.specInternist || "Internista";
    if (lower.includes('laryng')) return t.specLaryngologist || "Laryngolog";
    if (lower.includes('okul')) return "Okulista";
    if (lower.includes('chirur')) return "Chirurg";
    if (lower.includes('ortop')) return "Ortopeda";
    if (lower.includes('derma')) return "Dermatolog";
    return dbSpec;
  };

  const renderPriceInfo = (services: Service[]) => {
    if (!services || services.length === 0) {
      return <span style={{color: '#9ca3af', fontSize: '0.9rem'}}>Brak cennika</span>;
    }

    const hasNfz = services.some(s => s.isNfz);
    const privateServices = services.filter(s => !s.isNfz);
    
    let minPrice = 0;
    if (privateServices.length > 0) {
      minPrice = Math.min(...privateServices.map(s => parseFloat(s.price)));
    }

    return (
      <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
        {hasNfz && (
          <span style={{
            background: '#dcfce7', color: '#166534', padding: '2px 8px', 
            borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #bbf7d0'
          }}>
            {t.labelNfz}
          </span>
        )}
        
        {privateServices.length > 0 && (
          <span style={{ color: '#4b5563', fontSize: '0.85rem', fontWeight: 600 }}>
            {hasNfz ? ` / ` : ''}{t.labelPrivate || 'Prywatnie'}: {t.priceFrom} <span style={{color: '#2563eb'}}>{minPrice} PLN</span>
          </span>
        )}
      </div>
    );
  };

  const specializations = useMemo(() => {
    const specs = new Set(doctors.map(d => d.specialization));
    return Array.from(specs);
  }, [doctors]);

  const processedDoctors = useMemo(() => {
    return doctors.filter(d => {
      const matchesSpec = filterSpec === 'ALL' || d.specialization === filterSpec;
      const matchesSearch = d.user.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSpec && matchesSearch;
    });
  }, [doctors, filterSpec, searchQuery]);

  return (
    <div className="doctors-list-wrapper" style={{maxWidth: '1200px', margin: '0 auto', padding: '0 20px'}}>
      
      <header className="doctors-header" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h2 style={{fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', marginBottom: '10px'}}>{t.doctorsTitle}</h2>
        <p style={{fontSize: '1.1rem', color: '#64748b'}}>{t.subtitle}</p>
      </header>

      {/* PASEK FILTRÓW */}
      <div className="filters-bar" style={{
        background: 'white', padding: '25px', borderRadius: '16px', border: '1px solid #e2e8f0',
        marginBottom: '40px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }}>
        <div className="filter-input-wrapper" style={{display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '250px'}}>
          <label style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px'}}>{t.filterCat}</label>
          <select 
            value={filterSpec} 
            onChange={e => setFilterSpec(e.target.value)}
            style={{padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '1rem', fontWeight: 600, outline: 'none'}}
          >
            <option value="ALL">{t.optAll}</option>
            {specializations.map(rawSpec => (
              <option key={rawSpec} value={rawSpec}>{getLocalizedSpec(rawSpec)}</option>
            ))}
          </select>
        </div>

        <div className="filter-input-wrapper" style={{display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '250px'}}>
          <label style={{fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Szukaj lekarza</label>
          <input 
            type="text" 
            placeholder="Wpisz nazwisko..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '1rem', fontWeight: 600, outline: 'none'}}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Ładowanie listy specjalistów...</div>
      ) : processedDoctors.length === 0 ? (
        <div style={{textAlign: 'center', padding: '60px', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', color: '#64748b'}}>
          {t.noDoctors}
        </div>
      ) : (
        <div className="doctors-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px'}}>
          {processedDoctors.map((doctor) => (
            <div key={doctor.id} className="doctor-card" style={{
              background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '25px',
              display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease-in-out', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
            }}>
              <div style={{display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px'}}>
                {/* ZDJĘCIE LEKARZA - Pobierane z bazy (seed) */}
                <div style={{
                  width: '85px', height: '85px', borderRadius: '20px', flexShrink: 0,
                  backgroundImage: `url("${doctor.photoUrl || '/receptionist_portrait.jpg'}")`,
                  backgroundSize: 'cover', backgroundPosition: 'top center', backgroundRepeat: 'no-repeat',
                  border: '1px solid #f1f5f9'
                }}></div>
                
                <div style={{overflow: 'hidden'}}>
                  <h3 style={{fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{doctor.user.name}</h3>
                  <div style={{fontSize: '0.85rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px'}}>{getLocalizedSpec(doctor.specialization)}</div>
                </div>
              </div>

              <div style={{flex: 1, marginBottom: '20px'}}>
                {renderPriceInfo(doctor.services)}
              </div>
              
              <button 
                onClick={() => onBook(doctor)} 
                style={{
                  width: '100%', padding: '14px', background: '#0f172a', color: 'white', border: 'none',
                  borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}
              >
                {t.bookBtn}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}