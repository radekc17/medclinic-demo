// frontend/src/components/ClinicPortal.tsx
import { useEffect, useState } from 'react';
import { type Language } from '../translations';
import { DoctorsList } from './DoctorsList';
import toast from 'react-hot-toast';

interface Props {
  clinicId: number;
  lang: Language;
  onBook: (doctor: any) => void;
  onBack: () => void;
}

export function ClinicPortal({ clinicId, lang, onBook, onBack }: Props) {
  const [clinicData, setClinicData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://medclinic-demo.onrender.com/clinics/${clinicId}`)
      .then(res => res.json())
      .then(data => { setClinicData(data); setLoading(false); })
      .catch(() => toast.error('Błąd pobierania danych kliniki'));
  }, [clinicId]);

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>Ładowanie podstrony placówki...</div>;
  if (!clinicData) return <div>Nie znaleziono placówki.</div>;

  return (
    <div style={{maxWidth: '1200px', margin: '0 auto'}}>
      {/* PRZYCISK POWROTU */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', 
        fontSize: '1rem', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px'
      }}>
        ← Wróć do wyboru placówek
      </button>

      {/* BANER KONKRETNEJ KLINIKI */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '40px', marginBottom: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '8px solid #2563eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px'
      }}>
        <div>
          <h1 style={{margin: '0 0 10px 0', color: '#0f172a', fontSize: '2.5rem'}}>{clinicData.name}</h1>
          <p style={{margin: 0, color: '#64748b', fontSize: '1.2rem'}}>📍 {clinicData.address}</p>
        </div>
        <div style={{background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
          <p style={{margin: '0 0 5px 0', color: '#64748b'}}>Kontakt z recepcją:</p>
          <p style={{margin: 0, fontWeight: 'bold', fontSize: '1.2rem', color: '#2563eb'}}>📞 {clinicData.phone}</p>
          <p style={{margin: '5px 0 0 0', fontWeight: 'bold', color: '#2563eb'}}>📧 {clinicData.email}</p>
        </div>
      </div>

      {/* LISTA LEKARZY (Używamy Twojego gotowego komponentu, przekazując mu odfiltrowanych lekarzy z bazy!) */}
      <h2 style={{color: '#1e293b', marginBottom: '20px'}}>Lekarze dostępni w tej placówce:</h2>
      <DoctorsList doctors={clinicData.doctors} loading={false} lang={lang} onBook={onBook} />
    </div>
  );
}