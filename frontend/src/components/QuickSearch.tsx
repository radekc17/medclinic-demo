import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface QuickSearchProps {
  doctors: any[];
  onBook: (doctor: any, service: any, date: string, time: string) => void;
}

export function QuickSearch({ doctors, onBook }: QuickSearchProps) {
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 1. Wyciągamy unikalne specjalizacje z listy lekarzy
  const specializations = useMemo(() => {
    const specs = doctors.map(d => d.specialization).filter(Boolean);
    return Array.from(new Set(specs)).sort();
  }, [doctors]);

  // 2. Kiedy wybierzemy specjalizację, wyciągamy wszystkie usługi dla niej
  const availableServices = useMemo(() => {
    if (!selectedSpec) return [];
    const docs = doctors.filter(d => d.specialization === selectedSpec);
    const servicesMap = new Map();
    docs.forEach(doc => {
      doc.services?.forEach((svc: any) => {
        if (!servicesMap.has(svc.id)) servicesMap.set(svc.id, svc);
      });
    });
    return Array.from(servicesMap.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [selectedSpec, doctors]);

  // 3. Główna funkcja wyszukująca
  const handleSearch = async () => {
    if (!selectedSpec || !selectedServiceId || !selectedDate) {
      return toast.error("Wybierz specjalizację, usługę i datę!");
    }

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      // Znajdź lekarzy o tej specjalizacji
      const matchingDoctors = doctors.filter(d => d.specialization === selectedSpec);
      const allSlots: any[] = [];

      // Odpytaj backend o sloty DLA KAŻDEGO z nich (Promise.all dla szybkości)
      const fetchPromises = matchingDoctors.map(async (doc) => {
        // Sprawdzamy czy ten lekarz w ogóle wykonuje tę konkretną usługę
        const hasService = doc.services?.some((s: any) => s.id.toString() === selectedServiceId);
        if (!hasService) return;

        const res = await fetch(`http://localhost:3000/doctors/${doc.id}/slots?date=${selectedDate}&serviceId=${selectedServiceId}`);
        if (res.ok) {
          const slots = await res.json();
          // Dodajemy znalezione godziny do głównej listy, przypisując do nich lekarza
          slots.forEach((time: string) => {
            allSlots.push({ time, doctor: doc });
          });
        }
      });

      await Promise.all(fetchPromises);

      // Sortujemy wyniki chronologicznie (np. 08:00, 08:15, 09:30)
      allSlots.sort((a, b) => a.time.localeCompare(b.time));
      setResults(allSlots);

    } catch (error) {
      toast.error("Błąd podczas wyszukiwania terminów.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectedServiceObject = availableServices.find((s: any) => s.id.toString() === selectedServiceId);

  return (
    <div style={{ padding: '40px 5vw', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>🔍 Centralna Wyszukiwarka</h2>
          <p style={{ color: '#64748b', marginTop: '10px' }}>Znajdź najbliższy wolny termin u dowolnego specjalisty</p>
        </div>

        {/* FORMULARZ FILTRÓW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
          
          <div>
            <label style={styles.label}>Specjalizacja</label>
            <select value={selectedSpec} onChange={(e) => { setSelectedSpec(e.target.value); setSelectedServiceId(''); }} style={styles.input}>
              <option value="">-- Wybierz --</option>
              {specializations.map((spec: any) => <option key={spec} value={spec}>{spec}</option>)}
            </select>
          </div>

          <div>
            <label style={styles.label}>Usługa</label>
            <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} disabled={!selectedSpec} style={styles.input}>
              <option value="">-- Wybierz usługę --</option>
              {availableServices.map((svc: any) => (
                <option key={svc.id} value={svc.id}>{svc.name} ({svc.duration} min)</option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Data</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={styles.input} />
          </div>

        </div>

        <button onClick={handleSearch} disabled={isSearching} style={{ ...styles.primaryBtn, marginTop: '20px' }}>
          {isSearching ? '⏳ Wyszukiwanie...' : 'Szukaj wolnych terminów'}
        </button>

        {/* WYNIKI */}
        {hasSearched && (
          <div style={{ marginTop: '40px' }}>
            <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', color: '#0f172a' }}>Wyniki dla: {selectedDate}</h3>
            
            {results.length === 0 && !isSearching ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#fee2e2', color: '#dc2626', borderRadius: '12px', fontWeight: 'bold' }}>
                Brak wolnych terminów dla wybranych kryteriów. Spróbuj zmienić datę.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
                {results.map((slot, index) => (
                  <div key={index} style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', transition: 'box-shadow 0.2s' }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.15)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                    <div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563eb' }}>{slot.time}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155', marginTop: '5px' }}>{slot.doctor.user.name}</div>
                    </div>
                    <button 
                      onClick={() => onBook(slot.doctor, selectedServiceObject, selectedDate, slot.time)}
                      style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      UMÓW
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: any = {
  label: { display: 'block', fontWeight: 'bold', color: '#475569', marginBottom: '8px', fontSize: '0.9rem' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem', background: 'white' },
  primaryBtn: { width: '100%', background: '#2563eb', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.2s' }
};