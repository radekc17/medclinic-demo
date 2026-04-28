// frontend/src/components/MyAppointments.tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { translations, type Language } from '../translations';
import toast from 'react-hot-toast'; // <--- IMPORT

interface Appointment {
  id: number;
  date: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  doctor: {
    specialization: string;
    user: { name: string };
  };
}

interface Props {
  lang: Language;
  guestPesel?: string;
}

export function MyAppointments({ lang, guestPesel }: Props) {
  const t = translations[lang]; 
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      let url = '';
      let options = {};

      if (guestPesel) {
        url = 'https://medclinic-demo.onrender.com/appointments/guest-check';
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pesel: guestPesel })
        };
      } else {
        const token = localStorage.getItem('token');
        if (!token) return;
        url = 'https://medclinic-demo.onrender.com/appointments/my';
        options = {
          headers: { Authorization: `Bearer ${token}` }
        };
      }

      const res = await fetch(url, options);
      if (res.ok) {
        const data = await res.json();
        // Filtrujemy odwołane, żeby nie śmieciły listy
        const activeOnly = data.filter((app: Appointment) => app.status !== 'CANCELLED');
        setAppointments(activeOnly);
      }
    } catch (err) {
      console.error(err);
      toast.error('Błąd pobierania wizyt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [guestPesel]);

  const handleCancel = async (id: number) => {
    // Standardowe okno potwierdzenia jest OK
    const confirmed = window.confirm(t.confirmCancel);
    if (!confirmed) return;

    try {
      let url = '';
      let options = {};

      // LOGIKA ODWOŁYWANIA DLA GOŚCIA
      if (guestPesel) {
        url = `https://medclinic-demo.onrender.com/appointments/guest-cancel/${id}`;
        options = {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pesel: guestPesel })
        };
      } 
      // LOGIKA ODWOŁYWANIA DLA ZALOGOWANEGO
      else {
        const token = localStorage.getItem('token');
        url = `https://medclinic-demo.onrender.com/appointments/${id}/cancel`;
        options = {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        };
      }

      const res = await fetch(url, options);
      
      if (res.ok) {
        toast.success('Wizyta została odwołana'); // <--- TOAST SUKCESU
        fetchAppointments(); // Odświeżamy listę
      } else {
        const err = await res.json();
        toast.error(`Błąd: ${err.message}`); // <--- TOAST BŁĘDU
      }
    } catch (error) {
      toast.error('Błąd połączenia.');
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'CONFIRMED': return '#16a34a'; // Zielony
      case 'PENDING': return '#2563eb';   // Niebieski
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'CONFIRMED': return t.statusConfirmed;
      case 'PENDING': return lang === 'PL' ? 'ZAREZERWOWANA' : t.statusPending; 
      default: return status;
    }
  };

  if (loading) return <p style={{textAlign: 'center', padding: '20px'}}>{t.loadingData}</p>;

  return (
    <div style={{maxWidth: '800px', margin: '0 auto'}}>
      <h2 style={{marginBottom: '20px', fontSize: '1.5rem'}}>
        {guestPesel ? `${t.appointmentsFor}: ${guestPesel}` : t.myAppointments}
      </h2>
      
      {appointments.length === 0 ? (
        <div style={{padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
          <p style={{color: '#666'}}>{t.noAppointments}</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
          {appointments.map(app => (
            <div key={app.id} style={{
              background: 'white', padding: '20px', borderRadius: '12px', 
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px'
            }}>
              <div>
                {/* --- NOWOŚĆ: WYŚWIETLANIE NUMERKU BILETU --- */}
                <div style={{
                  display: 'inline-block', background: '#f8fafc', border: '2px dashed #cbd5e1', 
                  padding: '5px 15px', borderRadius: '8px', marginBottom: '10px'
                }}>
                  <span style={{fontSize: '0.8rem', color: '#64748b', display: 'block'}}>Numerek do gabinetu:</span>
                  <span style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb'}}>W-{String(app.id).padStart(3, '0')}</span>
                </div>
                {/* ------------------------------------------- */}

                <div style={{fontSize: '0.9rem', color: '#666', marginBottom: '4px'}}>
                  {format(new Date(app.date), 'dd.MM.yyyy')} | <strong style={{color: '#333'}}>{format(new Date(app.date), 'HH:mm')}</strong>
                </div>
                <h3 style={{margin: '0 0 5px 0', fontSize: '1.2rem'}}>{app.doctor.user.name}</h3>
                <span style={{background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#555'}}>
                  {app.doctor.specialization}
                </span>
              </div>

              <div style={{display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap'}}>
                <span style={{
                  fontWeight: 'bold', 
                  color: getStatusColor(app.status),
                  border: `1px solid ${getStatusColor(app.status)}`,
                  padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem',
                  whiteSpace: 'nowrap' // <--- ZAPOBIEGA ŁAMANIU TEKSTU
                }}>
                  {getStatusText(app.status)}
                </span>

                <button 
                  onClick={() => handleCancel(app.id)}
                  style={{
                    background: 'white', border: '1px solid #dc2626', color: '#dc2626',
                    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap' // <--- ZAPOBIEGA ŁAMANIU TEKSTU
                  }}
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}