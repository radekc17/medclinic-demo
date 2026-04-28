import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface PatientsRegistryProps {
  onBookVisit: (patient: any) => void;
}

export function PatientsRegistry({ onBookVisit }: PatientsRegistryProps) {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // --- STANY DLA MODALA WIZYT (OSOBNE OKNO) ---
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  
  const [historySubTab, setHistorySubTab] = useState<'planned' | 'past'>('planned');

  // Stany dla formularza dodawania pacjenta (ORYGINALNE)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPesel, setNewPesel] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = searchTerm.length >= 3 
        ? `https://medclinic-demo.onrender.com/users/search-patients?q=${searchTerm}` 
        : `https://medclinic-demo.onrender.com/users/patients-all`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setPatients(await res.json());
      }
    } catch (e) {
      toast.error("Błąd połączenia");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => fetchPatients(), 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const openAppointmentsModal = async (patient: any) => {
    setSelectedPatient(patient);
    setShowAppointmentsModal(true);
    setLoadingAppts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`https://medclinic-demo.onrender.com/appointments/guest-check`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ pesel: patient.pesel })
      });
      if (res.ok) {
        const data = await res.json();
        setPatientAppointments(data);
      }
    } catch (e) {
      toast.error("Błąd pobierania wizyt");
    } finally {
      setLoadingAppts(false);
    }
  };

  const handleCancelAppointment = async (appId: number, pesel: string) => {
    if (!window.confirm("Czy na pewno odwołać tę wizytę?")) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`https://medclinic-demo.onrender.com/appointments/guest-cancel/${appId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ pesel })
      });
      if (res.ok) {
        toast.success("Wizyta została odwołana");
        openAppointmentsModal(selectedPatient); 
      }
    } catch (e) {
      toast.error("Błąd podczas odwoływania");
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPesel.length !== 11) return toast.error("PESEL musi mieć 11 znaków");

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('https://medclinic-demo.onrender.com/users', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name: newName, 
          pesel: newPesel, 
          phone: newPhone, 
          email: newEmail, 
          role: 'PATIENT',
          password: 'LOCKED_' + Math.random().toString(36).slice(-8)
        })
      });

      if (res.ok) {
        toast.success("Pacjent dodany pomyślnie");
        setShowAddForm(false);
        fetchPatients();
        setNewName(''); setNewPesel(''); setNewPhone(''); setNewEmail('');
      } else {
        const err = await res.json();
        toast.error(err.message || "Błąd dodawania");
      }
    } catch (e) {
      toast.error("Błąd serwera");
    }
  };

  const nowTime = new Date();
  const planned = patientAppointments.filter(a => new Date(a.date) >= nowTime && a.status !== 'CANCELLED');
  const past = patientAppointments.filter(a => new Date(a.date) < nowTime || a.status === 'CANCELLED');

  return (
    <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-1px' }}>🗂️ Kartoteka Pacjentów</h2>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            style={{ 
                padding: '12px 24px', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                fontSize: '0.85rem',
                background: showAddForm ? '#64748b' : '#16a34a', // Szary przy anulowaniu, ładny zielony przy dodawaniu
                transition: 'all 0.2s',
                boxShadow: showAddForm ? 'none' : '0 4px 6px -1px rgba(22, 163, 74, 0.3)', // Świecący cień dla zielonego
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
          >
            {showAddForm ? '✖ Anuluj' : '➕ Dodaj pacjenta'}
          </button>
          <div style={{ position: 'relative' }}>
            <input
                type="text"
                placeholder="Szukaj po PESEL / Nazwisku..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                    padding: '12px 20px', width: '350px', borderRadius: 'var(--radius)', 
                    border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem'
                }}
            />
          </div>
        </div>
      </div>

      {showAddForm && (
        <div style={{ background: 'white', padding: '25px', borderRadius: 'var(--radius)', marginBottom: '30px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-md)' }}>
          <h4 style={{marginTop: 0, marginBottom: '20px', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-sub)'}}>Nowy wpis w kartotece</h4>
          <form onSubmit={handleAddPatient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '15px', alignItems: 'center' }}>
            <input placeholder="Imię i Nazwisko" value={newName} onChange={e => setNewName(e.target.value)} style={styles.miniInput} required />
            <input placeholder="PESEL" value={newPesel} onChange={e => setNewPesel(e.target.value.replace(/\D/g,''))} maxLength={11} style={styles.miniInput} required />
            <input placeholder="Telefon" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={styles.miniInput} required />
            <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={styles.miniInput} />
            <button type="submit" style={{ ...styles.btnSave, background: 'var(--accent)', fontWeight: 800 }}>ZAPISZ</button>
          </form>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={styles.th}>Pacjent</th>
              <th style={styles.th}>PESEL</th>
              <th style={styles.th}>Kontakt</th>
              <th style={{...styles.th, textAlign: 'center'}}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{padding: '40px', textAlign: 'center', fontWeight: 700}}>Ładowanie bazy danych...</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={4} style={{padding: '40px', textAlign: 'center', color: 'var(--text-sub)'}}>Brak wyników wyszukiwania.</td></tr>
            ) : (
              patients.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={styles.td}>
                    <button 
                      onClick={() => openAppointmentsModal(p)} 
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <strong style={{ fontSize: '1rem' }}>{p.name}</strong> <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>🔍</span>
                    </button>
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{p.pesel}</td>
                  <td style={styles.td}>
                    <div style={{fontSize: '0.9rem', fontWeight: 700}}>📞 {p.phone}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-sub)'}}>{p.email || 'Brak adresu e-mail'}</div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button 
                      onClick={() => onBookVisit(p)}
                      style={{ 
                          padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', 
                          borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase'
                      }}
                    >
                      📞 Umów wizytę
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAppointmentsModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowAppointmentsModal(false)}>
          <div className="modal-content sharp-card" style={{ maxWidth: '850px', height: '650px', display: 'flex', flexDirection: 'column', padding: '30px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800, color: 'var(--primary)' }}>Karta Wizyt: {selectedPatient.name}</h3>
              <button onClick={() => setShowAppointmentsModal(false)} className="btn-close">&times;</button>
            </div>
            
            <div style={{ padding: '10px 0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <button 
                    onClick={() => setHistorySubTab('planned')}
                    style={{ ...styles.tabBtn, background: historySubTab === 'planned' ? 'var(--accent)' : 'var(--bg-app)', color: historySubTab === 'planned' ? 'white' : 'var(--text-sub)' }}
                  >
                    📅 Zaplanowane ({planned.length})
                  </button>
                  <button 
                    onClick={() => setHistorySubTab('past')}
                    style={{ ...styles.tabBtn, background: historySubTab === 'past' ? 'var(--accent)' : 'var(--bg-app)', color: historySubTab === 'past' ? 'white' : 'var(--text-sub)' }}
                  >
                    📜 Historia ({past.length})
                  </button>
               </div>

              {loadingAppts ? (
                <p style={{textAlign:'center', padding:'40px', fontWeight: 700}}>Pobieranie wizyt z serwera...</p>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 'var(--radius)' }}>
                  {(historySubTab === 'planned' ? planned : past).length === 0 ? (
                    <p style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '40px', fontStyle: 'italic' }}>Brak wizyt w tej sekcji.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px' }}>
                      {(historySubTab === 'planned' ? planned : past).map((app: any) => (
                        <div key={app.id} style={{
                          padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderLeft: app.status === 'CANCELLED' ? '5px solid #dc2626' : '5px solid #059669'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>{format(new Date(app.date), 'dd.MM.yyyy | HH:mm')}</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Lekarz: <span style={{color: 'var(--accent)'}}>{app.doctor?.user?.name}</span></div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 600 }}>Usługa: {app.service?.name}</div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <span style={{ 
                                fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '20px', textAlign: 'center',
                                background: app.status === 'CANCELLED' ? '#fee2e2' : '#ecfdf5',
                                color: app.status === 'CANCELLED' ? '#dc2626' : '#059669'
                            }}>
                                {app.status === 'CANCELLED' ? 'Odwołana' : historySubTab === 'planned' ? 'Oczekuje' : 'Zrealizowana'}
                            </span>
                            {app.status !== 'CANCELLED' && new Date(app.date) > nowTime && (
                                <button 
                                onClick={() => handleCancelAppointment(app.id, selectedPatient.pesel)}
                                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}
                                >
                                ODWOŁAJ
                                </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button onClick={() => setShowAppointmentsModal(false)} style={{ ...styles.btnSave, background: 'var(--primary)', marginTop: '20px', width: '100%', fontWeight: 800 }}>ZAMKNIJ KARTĘ</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  th: { padding: '15px', textAlign: 'left', color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' },
  td: { padding: '15px', color: 'var(--primary)' },
  miniInput: { padding: '12px', borderRadius: 'var(--radius)', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', outline: 'none' },
  btnSave: { padding: '12px 24px', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.8rem' },
  tabBtn: { padding: '12px 20px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', transition: 'all 0.2s', textTransform: 'uppercase' }
};