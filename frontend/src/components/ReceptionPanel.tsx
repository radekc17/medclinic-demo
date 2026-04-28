import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

// --- TYPY DANYCH Z UWZGLĘDNIENIEM KLINIK ---
interface Appointment {
  id: number;
  date: string;
  status: 'PENDING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ABSENT';
  patient?: { id?: number; name: string; phone: string; pesel: string; email?: string };
  guestName?: string;
  guestPhone?: string;
  guestPesel?: string;
  guestEmail?: string;
  service: { name: string; price: number; duration: number };
  isConfirmed?: boolean;
  manualCheckRequired?: boolean;
  doctorId: number; 
  doctor?: { user: { name: string }; clinic?: { name: string } }; 
}

interface DoctorStatus {
  id: number;
  specialization: string;
  currentDelay: number;
  workStatus: 'AVAILABLE' | 'BREAK' | 'WORK_INTERNAL';
  user: { name: string };
  appointments: Appointment[];
  clinic?: { id: number; name: string }; 
  _count: { appointments: number };
}

// ZMIANA: Dodano obsługę propa onBookVisit (tak jak w kartotece)
export function ReceptionPanel({ user, onBookVisit }: { user?: any; onBookVisit?: (patient: any) => void }) { 
  const [doctors, setDoctors] = useState<DoctorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // --- MULTI-CLINIC TABS ---
  const [selectedClinic, setSelectedClinic] = useState<string>('ALL');

  // --- MODALE ---
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [doctorManagement, setDoctorManagement] = useState<DoctorStatus | null>(null);
  const [showDelayList, setShowDelayList] = useState(false); 
  const [modalTab, setModalTab] = useState<'info' | 'history'>('info');
  const [patientHistory, setPatientHistory] = useState<Appointment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showConfirmationList, setShowConfirmationList] = useState(false);

  // --- WYSZUKIWARKA ---
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:3000/doctors/reception-status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setDoctors(data);
    } catch (err) {
      console.error("Błąd pobierania statusu recepcji");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientHistory = async (pesel: string) => {
    setLoadingHistory(true);
    setModalTab('history');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/appointments/guest-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pesel })
      });
      if (res.ok) setPatientHistory(await res.json());
    } catch (e) { toast.error("Błąd pobierania historii"); } 
    finally { setLoadingHistory(false); }
  };

  // --- LOGIKA WYSZUKIWARKI ---
  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (searchDate) params.append('date', searchDate);
      if (searchQuery) params.append('query', searchQuery);

      const res = await fetch(`http://localhost:3000/appointments/reception-search?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (e) {
      toast.error("Błąd wyszukiwania");
    } finally {
      setIsSearching(false);
    }
  };

  const manualConfirm = async (appId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/appointments/${appId}/confirm`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Wizyta potwierdzona telefonicznie");
        fetchData(); 
        if (showSearchModal) handleSearch();
      }
    } catch (e) { toast.error("Błąd zapisu potwierdzenia"); }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`http://localhost:3000/doctors/${id}/work-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ status })
    });
    fetchData();
    toast.success("Wymuszono zmianę statusu");
  };

  // ZMIANA: Obsługa przekierowania danych pacjenta do głównego kalendarza rezerwacji
  const cancelAndFreeSlot = async (appId: number, isRescheduling = false, patientData: any = null) => {
    const msg = isRescheduling 
      ? "Aby przełożyć wizytę, musimy zablokować obecny termin. Po kliknięciu OK termin zostanie zwolniony, a system otworzy główny kalendarz dla tego pacjenta. Kontynuować?"
      : "Czy na pewno chcesz odwołać wizytę i zwolnić ten termin?";
      
    if (!window.confirm(msg)) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/appointments/reception-cancel/${appId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        if (isRescheduling) {
          toast.success("✅ Termin zwolniony! Otwieram główny kalendarz rezerwacji...");
          setShowSearchModal(false); // Zamykamy wyszukiwarkę
          
          // Wywołujemy przekazaną funkcję do rezerwacji z danymi tego pacjenta
          if (onBookVisit && patientData) {
            onBookVisit(patientData);
          } else {
            toast.error("Brak konfiguracji modułu rezerwacji");
          }
        } else {
          toast.success("Wizyta została pomyślnie odwołana.");
        }
        fetchData(); 
        if (showSearchModal && !isRescheduling) handleSearch();
      } else {
        toast.error("Błąd podczas zwalniania terminu.");
      }
    } catch (e) {
      toast.error("Błąd połączenia z serwerem.");
    }
  };

  useEffect(() => {
    fetchData();
    const dataTimer = setInterval(fetchData, 5000);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, []);

  const getDelayedPatients = (activeDoctors: DoctorStatus[]) => {
    const list: any[] = [];
    activeDoctors.forEach(doc => {
        if (doc.currentDelay > 0) {
            const pendingApps = doc.appointments.filter(a => a.status === 'PENDING');
            pendingApps.forEach(app => {
                list.push({
                    id: app.id, time: app.date, doctorName: doc.user.name,
                    patientName: app.patient?.name || app.guestName,
                    phone: app.patient?.phone || app.guestPhone || 'Brak numeru',
                    delay: doc.currentDelay, clinicName: doc.clinic?.name || 'Główna Centrala'
                });
            });
        }
    });
    return list.sort((a, b) => b.delay - a.delay);
  };

  const getUnconfirmedAppointments = (activeDoctors: DoctorStatus[]) => {
    const list: any[] = [];
    activeDoctors.forEach(doc => {
      doc.appointments.forEach(app => {
        if (app.manualCheckRequired && !app.isConfirmed && app.status === 'PENDING') {
          list.push({ ...app, doctorName: doc.user.name, clinicName: doc.clinic?.name || 'Główna Centrala' });
        }
      });
    });
    return list;
  };

  const getLiveStatus = (doc: DoctorStatus) => {
    if (doc.workStatus === 'BREAK') return { text: 'PRZERWA', color: '#64748b', bg: '#f8fafc', icon: '☕' };
    if (doc.workStatus === 'WORK_INTERNAL') return { text: 'PRACA WEWNĘTRZNA', color: '#b45309', bg: '#fffbeb', icon: '📑' };

    const activeVisit = doc.appointments.find(a => a.status === 'IN_PROGRESS');
    const calledVisit = doc.appointments.find(a => a.status === 'CALLED');

    if (activeVisit) {
      return { 
        text: `W GABINECIE: ${activeVisit.patient?.name || activeVisit.guestName || 'Anonim'}`, 
        color: '#2563eb', bg: '#eff6ff', icon: '👨‍⚕️', details: activeVisit.service.name
      };
    }

    if (calledVisit) {
        return {
            text: `WEZWANO: ${calledVisit.patient?.name || calledVisit.guestName || 'Anonim'}`,
            color: '#ea580c', bg: '#fff7ed', icon: '📢', details: 'Pacjent idzie do gabinetu'
        };
    }

    return { text: 'OCZEKUJE NA PACJENTA', color: '#059669', bg: '#ecfdf5', icon: '✅' };
  };

  if (loading) return <div className="loader" style={{padding: '50px', textAlign: 'center'}}>Ładowanie Radarów...</div>;

  const userClinicId = user?.clinicId;
  const allowedDoctors = userClinicId ? doctors.filter(d => d.clinic?.id === userClinicId) : doctors;
  const availableClinics = Array.from(new Set(allowedDoctors.map(d => d.clinic?.name || 'Główna Centrala')));
  const displayedDoctors = selectedClinic === 'ALL' ? allowedDoctors : allowedDoctors.filter(d => (d.clinic?.name || 'Główna Centrala') === selectedClinic);

  const delayedPatientsList = getDelayedPatients(displayedDoctors);
  const unconfirmedList = getUnconfirmedAppointments(displayedDoctors);

  return (
    <div className="reception-container" style={{ backgroundColor: 'var(--bg-app)', minHeight: '100vh', padding: '30px 5vw', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* NAGŁÓWEK */}
      <header className="reception-header" style={{flexDirection: 'column', alignItems: 'stretch', gap: '20px', padding: '25px', background: 'white', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)', marginBottom: '30px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '20px'}}>
            <div>
              <h2 className="page-title" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-1px', margin: 0 }}>Radar Gabinetów</h2>
              <p className="page-subtitle" style={{ color: 'var(--text-sub)', fontWeight: 600, margin: '5px 0 0 0' }}>{format(now, 'HH:mm:ss')} | <span style={{ textTransform: 'capitalize' }}>{format(now, 'eeee, d MMMM yyyy', { locale: pl })}</span></p>
            </div>
            <div style={{display: 'flex', gap: '15px'}}>
              <button onClick={() => setShowSearchModal(true)} style={{
                      display:'flex', alignItems:'center', gap:'12px', padding:'12px 24px', borderRadius:'var(--radius)',
                      background: '#f8fafc', color: 'var(--primary)',
                      fontWeight: '800', cursor:'pointer', border: '1px solid #e2e8f0',
                      transition: 'all 0.2s', fontSize: '0.85rem'
                  }}>
                  🔍 WYSZUKAJ WIZYTĘ
              </button>
              <button onClick={() => setShowConfirmationList(true)} style={{
                      display:'flex', alignItems:'center', gap:'12px', padding:'12px 24px', borderRadius:'var(--radius)',
                      background: unconfirmedList.length > 0 ? '#fff7ed' : '#f8fafc', color: unconfirmedList.length > 0 ? '#c2410c' : 'var(--text-sub)',
                      fontWeight: '800', cursor:'pointer', border: unconfirmedList.length > 0 ? '2px solid #fed7aa' : '1px solid #e2e8f0',
                      transition: 'all 0.2s', fontSize: '0.85rem'
                  }}>
                  📞 WERYFIKACJE {unconfirmedList.length > 0 && <span style={{background:'#c2410c', color:'white', borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem'}}>{unconfirmedList.length}</span>}
              </button>
              <button onClick={() => setShowDelayList(true)} style={{
                      display:'flex', alignItems:'center', gap:'12px', padding:'12px 24px', borderRadius:'var(--radius)',
                      background: delayedPatientsList.length > 0 ? '#fee2e2' : '#f8fafc', color: delayedPatientsList.length > 0 ? '#b91c1c' : 'var(--text-sub)',
                      fontWeight: '800', cursor:'pointer', border: delayedPatientsList.length > 0 ? '2px solid #f87171' : '1px solid #e2e8f0',
                      transition: 'all 0.2s', fontSize: '0.85rem'
                  }}>
                  ⚠️ ALERTY OPÓŹNIEŃ {delayedPatientsList.length > 0 && <span style={{background:'#b91c1c', color:'white', borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem'}}>{delayedPatientsList.length}</span>}
              </button>
            </div>
        </div>

        {availableClinics.length > 1 && (
            <div style={{display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '15px'}}>
                <button onClick={() => setSelectedClinic('ALL')} style={{ padding: '10px 20px', background: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', border: 'none', borderBottom: selectedClinic === 'ALL' ? '3px solid var(--accent)' : '3px solid transparent', color: selectedClinic === 'ALL' ? 'var(--accent)' : 'var(--text-sub)', textTransform: 'uppercase', transition: 'all 0.2s' }}>Wszystkie Lokalizacje</button>
                {availableClinics.map(clinicName => (
                    <button key={clinicName} onClick={() => setSelectedClinic(clinicName)} style={{ padding: '10px 20px', background: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', border: 'none', borderBottom: selectedClinic === clinicName ? '3px solid var(--accent)' : '3px solid transparent', color: selectedClinic === clinicName ? 'var(--accent)' : 'var(--text-sub)', textTransform: 'uppercase', transition: 'all 0.2s' }}>📍 {clinicName}</button>
                ))}
            </div>
        )}
      </header>

      {/* GRID GABINETÓW */}
      <div className="reception-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '25px', alignItems: 'start' }}>
        {displayedDoctors.length === 0 ? (
          <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: '60px', background: 'white', borderRadius: 'var(--radius)', border: '1px dashed #cbd5e1'}}>
            <p style={{color: 'var(--text-sub)', fontWeight: 700, fontSize: '1.1rem'}}>Brak aktywnych lekarzy w wybranej lokalizacji.</p>
          </div>
        ) : (
          displayedDoctors.map(doc => {
            const status = getLiveStatus(doc);
            return (
              <div key={doc.id} className="reception-card" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', background: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}>
                <div className="card-top" style={{ padding: '20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <span className="specialization" style={{ display:'inline-block', color: 'var(--accent)', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{doc.specialization}</span>
                    <h3 style={{ margin: '0', fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.5px' }}>{doc.user.name}</h3>
                    {selectedClinic === 'ALL' && <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginTop: '4px' }}>📍 {doc.clinic?.name || 'Główna Centrala'}</span>}
                  </div>
                  <button className="btn-settings" onClick={() => setDoctorManagement(doc)} style={{ background: 'none', border: 'none', opacity: 0.5, fontSize: '1.3rem', cursor: 'pointer' }}>⚙️</button>
                </div>
                
                <div style={{ padding: '0 20px 20px 20px' }}>
                    <div className="live-status-box" style={{ background: status.bg, color: status.color, borderRadius: '12px', padding: '15px', border: `1px solid ${status.color}25`, marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span className="status-icon" style={{ fontSize: '1.8rem' }}>{status.icon}</span>
                        <div style={{display:'flex', flexDirection:'column'}}>
                            <span className="status-text" style={{ fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{status.text}</span>
                            {status.details && <span className="status-sub" style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 700 }}>{status.details}</span>}
                        </div>
                    </div>
                    
                    {doc.currentDelay > 0 && (
                        <div className="delay-alert" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', margin: '15px 0', fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' }}>
                            ⚠️ Opóźnienie: {doc.currentDelay} min
                        </div>
                    )}
                    
                    <div className="appointments-mini-list" style={{ background: '#f8fafc', borderRadius: '12px', padding: '15px', marginTop: '20px', border: '1px solid #f1f5f9' }}>
                        <p className="list-title" style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px', margin: '0 0 12px 0' }}>Kolejka Pacjentów (Dzisiaj):</p>
                        {doc.appointments.length === 0 ? <p style={{fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0, fontStyle: 'italic', textAlign: 'center', padding: '10px'}}>Brak pacjentów na liście.</p> : null}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {doc.appointments.map(app => (
                                <div key={app.id} style={{ 
                                    opacity: ['COMPLETED', 'CANCELLED', 'ABSENT'].includes(app.status) ? 0.4 : 1,
                                    background: app.status === 'IN_PROGRESS' ? 'white' : 'transparent',
                                    padding: '10px 12px', borderRadius: '8px', border: app.status === 'IN_PROGRESS' ? '2px solid var(--accent)' : '1px solid transparent',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                }} onClick={() => setSelectedApp(app)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                        <span className="app-time" style={{fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem', width: '45px', textDecoration: ['COMPLETED', 'CANCELLED', 'ABSENT'].includes(app.status) ? 'line-through' : 'none'}}>{format(new Date(app.date), 'HH:mm')}</span>
                                        <span className="app-patient" style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                                            <strong style={{color: 'var(--accent)', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.75rem', fontWeight: 900}}>
                                            W-{String(app.id).padStart(3, '0')}
                                            </strong>
                                            {app.patient?.name || app.guestName}
                                        </span>
                                    </div>
                                    <span className="app-badge" style={{ fontSize: '1rem' }}>{app.status === 'COMPLETED' ? '✅' : '👤'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL WYSZUKIWARKI I ZARZĄDZANIA */}
      {showSearchModal && (
        <div className="modal-overlay" style={modalOverlayStyle} onClick={() => setShowSearchModal(false)}>
          <div className="modal-content sharp-card" style={{...modalContentStyle, maxWidth: '1050px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px'}}>
              <h3 style={{ fontWeight: 900, color: 'var(--primary)', margin: 0, fontSize: '1.5rem' }}>🔍 Zarządzanie i Wyszukiwarka Wizyt</h3>
              <button className="btn-close" style={closeBtnStyle} onClick={() => setShowSearchModal(false)}>×</button>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', display: 'flex', gap: '15px', marginTop: '20px', alignItems: 'flex-end', border: '1px solid #e2e8f0' }}>
              <div style={{flex: 1}}>
                <label style={{display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px'}}>Pacjent (Nazwisko, PESEL, Tel)</label>
                <input 
                  type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="np. Kowalski..." 
                  style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div>
                <label style={{display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px'}}>Dzień</label>
                <input 
                  type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} 
                  style={{padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                />
              </div>
              <button onClick={handleSearch} style={{padding: '12px 25px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', height: '45px'}}>
                {isSearching ? '...' : 'SZUKAJ'}
              </button>
            </div>

            <div style={{flex: 1, overflowY: 'auto', marginTop: '20px'}}>
              {searchResults.length === 0 ? (
                <p style={{textAlign:'center', color:'#64748b', marginTop: '40px'}}>Brak wyników lub nie rozpoczęto wyszukiwania.</p>
              ) : (
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                  <thead style={{background: '#f8fafc'}}>
                    <tr style={{textAlign:'left', borderBottom: '2px solid #e2e8f0'}}>
                      <th style={thStyle}>Pacjent</th>
                      <th style={thStyle}>Termin & Lokalizacja</th>
                      <th style={thStyle}>Usługa</th>
                      <th style={{...thStyle, textAlign:'right', paddingRight: '25px'}}>Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults
                      .filter(app => selectedClinic === 'ALL' || app.doctor?.clinic?.name === selectedClinic)
                      .map(app => (
                      <tr key={app.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'12px'}}>
                          <strong>{app.patient?.name || app.guestName}</strong><br/>
                          <small>📞 {app.patient?.phone || app.guestPhone}</small>
                        </td>
                        <td style={{padding:'12px'}}>
                          <span style={{fontWeight:800, color:'var(--primary)'}}>{format(new Date(app.date), 'dd.MM.yyyy HH:mm')}</span><br/>
                          <small>Lekarz: {app.doctor?.user?.name} | {app.doctor?.clinic?.name}</small>
                        </td>
                        <td style={{padding:'12px'}}>
                          {app.service?.name}<br/>
                          <small style={{fontWeight:800, color: app.isConfirmed ? '#059669' : '#ea580c'}}>{app.isConfirmed ? 'Potwierdzona' : 'Niepotwierdzona'}</small>
                        </td>
                        <td style={{padding:'12px', textAlign: 'right'}}>
                            <div style={{display:'flex', gap:'8px', justifyContent: 'flex-end'}}>
                              {/* ZMIANA: PRZEKAZANIE DANYCH PACJENTA DO onBookVisit */}
                              <button onClick={() => {
                                  const pData = {
                                    id: app.patient?.id || undefined,
                                    name: app.patient?.name || app.guestName,
                                    pesel: app.patient?.pesel || app.guestPesel,
                                    phone: app.patient?.phone || app.guestPhone,
                                    email: app.patient?.email || app.guestEmail
                                  };
                                  cancelAndFreeSlot(app.id, true, pData);
                              }} style={{background:'#f1f5f9', color:'var(--primary)', border:'1px solid #cbd5e1', borderRadius:'6px', padding:'8px 12px', fontWeight:800, cursor: 'pointer'}}>
                                📅 PRZEŁÓŻ
                              </button>
                              <button onClick={() => cancelAndFreeSlot(app.id)} style={{background:'#dc2626', color:'white', border:'none', borderRadius:'6px', padding:'8px 12px', fontWeight:800, cursor: 'pointer'}}>
                                ✕ ODWOŁAJ
                              </button>
                            </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button className="btn-auth full-width" style={{marginTop:'20px', padding: '15px', background:'#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', letterSpacing: '1px'}} onClick={() => setShowSearchModal(false)}>ZAMKNIJ WYSZUKIWARKĘ</button>
          </div>
        </div>
      )}

      {/* MODAL WERYFIKACJI */}
      {showConfirmationList && (
        <div className="modal-overlay" style={modalOverlayStyle} onClick={() => setShowConfirmationList(false)}>
          <div className="modal-content sharp-card" style={{...modalContentStyle, maxWidth: '850px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '15px'}}>
              <h3 style={{ fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.5px', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{color: '#e11d48'}}>📞</span> Weryfikacja wizyt
              </h3>
              <button className="btn-close" style={closeBtnStyle} onClick={() => setShowConfirmationList(false)}>×</button>
            </div>
            <div style={{flex: 1, overflowY: 'auto', paddingRight: '5px'}}>
              {unconfirmedList.length === 0 ? (
                <div style={{padding:'40px', textAlign:'center', color:'#059669', background: '#ecfdf5', borderRadius: 'var(--radius)'}}>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>✅ Wszystkie wizyty potwierdzone!</p>
                </div>
              ) : (
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.95rem'}}>
                  <thead style={{background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10}}>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{...thStyle, width: '30%'}}>Pacjent</th>
                      <th style={{...thStyle, width: '40%'}}>Termin & Lekarz</th>
                      <th style={{...thStyle, width: '30%', textAlign: 'right'}}>Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unconfirmedList.map(app => (
                      <tr key={app.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'15px 15px 15px 0'}}>
                          <strong style={{ color: '#1e293b', fontSize: '1.05rem' }}>{app.patient?.name || app.guestName}</strong><br/>
                          <small style={{ color: '#e11d48', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>📞 {app.patient?.phone || app.guestPhone}</small>
                        </td>
                        <td style={{padding:'15px 15px 15px 0'}}>
                          <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem' }}>{format(new Date(app.date), 'dd.MM HH:mm')}</span>{' '}
                          <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.9rem' }}>({app.clinicName})</span><br/>
                          <small style={{ color: '#64748b', fontSize: '0.85rem', display: 'inline-block', marginTop: '4px' }}>Lekarz: <strong style={{color: '#475569'}}>{app.doctorName}</strong></small>
                        </td>
                        <td style={{padding:'15px 0 15px 15px', textAlign: 'right'}}>
                          <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                            <button onClick={() => manualConfirm(app.id)} style={{...actionBtnStyle, background:'#059669', display: 'flex', alignItems: 'center', gap: '6px'}}>☑ POTWIERDŹ</button>
                            <button onClick={() => cancelAndFreeSlot(app.id)} style={{...actionBtnStyle, background:'#dc2626', display: 'flex', alignItems: 'center', gap: '6px'}}>✕ ZWOLNIJ</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button className="btn-auth full-width" style={{marginTop:'20px', padding: '15px', background:'#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', letterSpacing: '1px'}} onClick={() => setShowConfirmationList(false)}>ZAMKNIJ PODGLĄD</button>
          </div>
        </div>
      )}

      {/* MODAL ALERTY OPÓŹNIEŃ */}
      {showDelayList && (
        <div className="modal-overlay" style={modalOverlayStyle} onClick={() => setShowDelayList(false)}>
            <div className="modal-content sharp-card" style={{...modalContentStyle, maxWidth: '850px'}} onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px'}}>
                    <h3 style={{ fontWeight: 900, color: '#dc2626', margin: 0, fontSize: '1.5rem' }}>⚠️ Alerty opóźnień (Live)</h3>
                    <button className="btn-close" style={closeBtnStyle} onClick={() => setShowDelayList(false)}>×</button>
                </div>
                <div style={{maxHeight:'450px', overflowY:'auto', marginTop: '20px'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.95rem'}}>
                        <thead>
                            <tr style={{background:'#f8fafc', textAlign:'left', borderBottom: '2px solid #f1f5f9'}}>
                                <th style={thStyle}>Godz.</th>
                                <th style={thStyle}>Pacjent</th>
                                <th style={thStyle}>Lekarz</th>
                                <th style={thStyle}>Poślizg</th>
                            </tr>
                        </thead>
                        <tbody>
                            {delayedPatientsList.map(item => (
                                <tr key={item.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                                    <td style={{padding:'12px', fontWeight:'800', color: 'var(--primary)'}}>{format(new Date(item.time), 'HH:mm')}</td>
                                    <td style={{padding:'12px', fontWeight: 600}}>{item.patientName}</td>
                                    <td style={{padding:'12px'}}><span style={{fontWeight: 700}}>{item.doctorName}</span><br/><small style={{color:'var(--text-sub)', fontWeight: 600}}>{item.clinicName}</small></td>
                                    <td style={{padding:'12px', color:'#dc2626', fontWeight:'900', fontSize: '1rem'}}>+{item.delay} MIN</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button className="btn-auth full-width" style={{marginTop:'25px', padding: '15px', background:'#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer'}} onClick={() => setShowDelayList(false)}>ZAMKNIJ POWIADOMIENIA</button>
            </div>
        </div>
      )}

      {/* MODAL KARTA PACJENTA */}
      {selectedApp && (
        <div className="modal-overlay" style={modalOverlayStyle} onClick={() => { setSelectedApp(null); setModalTab('info'); }}>
          <div className="modal-content sharp-card" style={{...modalContentStyle, maxWidth: modalTab === 'info' ? '480px' : '850px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px'}}>
              <h3 style={{ fontWeight: 900, color: 'var(--primary)', margin: 0, fontSize: '1.5rem' }}>Profil Pacjenta</h3>
              <button className="btn-close" style={closeBtnStyle} onClick={() => { setSelectedApp(null); setModalTab('info'); }}>×</button>
            </div>
            <div style={{display:'flex', borderBottom:'1px solid #f1f5f9', marginBottom:'20px', marginTop: '10px'}}>
              <button onClick={() => setModalTab('info')} style={{flex: 1, padding:'12px', border:'none', background:'none', cursor:'pointer', borderBottom: modalTab === 'info' ? '3px solid var(--accent)' : '3px solid transparent', fontWeight:'800', color: modalTab === 'info' ? 'var(--accent)' : 'var(--text-sub)', textTransform: 'uppercase', fontSize: '0.75rem'}}>👤 Dane</button>
              <button onClick={() => fetchPatientHistory(selectedApp.patient?.pesel || selectedApp.guestPesel || '')} style={{flex: 1, padding:'12px', border:'none', background:'none', cursor:'pointer', borderBottom: modalTab === 'history' ? '3px solid var(--accent)' : '3px solid transparent', fontWeight:'800', color: modalTab === 'history' ? 'var(--accent)' : 'var(--text-sub)', textTransform: 'uppercase', fontSize: '0.75rem'}}>📜 Historia</button>
            </div>
            <div style={{flex: 1, overflowY: 'auto'}}>
              {modalTab === 'info' ? (
                <div className="info-grid">
                  <div style={{ marginBottom: '25px', textAlign: 'center', background: 'var(--bg-app)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0' }}>
                    <strong style={{fontSize: '3rem', fontWeight: '900', color: 'var(--accent)', letterSpacing: '2px'}}>W-{String(selectedApp.id).padStart(3, '0')}</strong>
                  </div>
                  <p style={detailRowStyle}><strong>Pacjent:</strong> {selectedApp.patient?.name || selectedApp.guestName}</p>
                  <p style={detailRowStyle}><strong>PESEL:</strong> {selectedApp.patient?.pesel || selectedApp.guestPesel || 'BRAK'}</p>
                  <p style={detailRowStyle}><strong>Status:</strong> <span style={{color: selectedApp.isConfirmed ? '#059669' : '#ea580c', fontWeight: 900}}>{selectedApp.isConfirmed ? 'Potwierdzona' : 'Niepotwierdzona'}</span></p>
                </div>
              ) : (
                <div style={{width: '100%'}}>
                   {loadingHistory ? <p style={{textAlign: 'center', padding: '20px'}}>Pobieranie...</p> : (
                     <table style={{width:'100%', borderCollapse:'collapse'}}>
                       <thead><tr style={{background:'#f8fafc'}}><th style={thStyle}>Data</th><th style={thStyle}>Usługa</th><th style={thStyle}>Status</th></tr></thead>
                       <tbody>{patientHistory.map(h => (<tr key={h.id} style={{borderBottom:'1px solid #f1f5f9'}}><td style={{padding:'12px'}}>{format(new Date(h.date), 'dd.MM.yyyy')}</td><td style={{padding:'12px'}}>{h.service.name}</td><td style={{padding:'12px'}}>{h.status}</td></tr>))}</tbody>
                     </table>
                   )}
                </div>
              )}
            </div>
            <button className="btn-auth full-width" style={{marginTop:'25px', padding: '15px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer'}} onClick={() => { setSelectedApp(null); setModalTab('info'); }}>ZAMKNIJ</button>
          </div>
        </div>
      )}

      {/* MODAL ZARZĄDZANIE LEKARZEM */}
      {doctorManagement && (
        <div className="modal-overlay" style={modalOverlayStyle} onClick={() => setDoctorManagement(null)}>
          <div className="modal-content sharp-card" style={{ ...modalContentStyle, maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px'}}>
              <h3 style={{ fontWeight: 900, color: 'var(--primary)', margin: 0, fontSize: '1.3rem' }}>Status: {doctorManagement.user.name}</h3>
              <button className="btn-close" style={closeBtnStyle} onClick={() => setDoctorManagement(null)}>×</button>
            </div>
            <div className="status-buttons-grid" style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop:'20px'}}>
              <button onClick={() => updateStatus(doctorManagement.id, 'AVAILABLE')} style={{...statusBtnStyle, border: doctorManagement.workStatus === 'AVAILABLE' ? '2px solid #059669' : '1px solid #e2e8f0'}}>🟢 DOSTĘPNY</button>
              <button onClick={() => updateStatus(doctorManagement.id, 'BREAK')} style={{...statusBtnStyle, border: doctorManagement.workStatus === 'BREAK' ? '2px solid #64748b' : '1px solid #e2e8f0'}}>☕ PRZERWA</button>
              <button onClick={() => updateStatus(doctorManagement.id, 'WORK_INTERNAL')} style={{...statusBtnStyle, border: doctorManagement.workStatus === 'WORK_INTERNAL' ? '2px solid #ea580c' : '1px solid #e2e8f0'}}>📑 PRACA WEWNĘTRZNA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Style ---
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' };
const modalContentStyle: React.CSSProperties = { background: 'white', borderRadius: '16px', width: '90%', maxWidth: '850px', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', padding: '30px' };
const closeBtnStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b', lineHeight: 0.5 };
const thStyle: React.CSSProperties = { padding: '12px 15px', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748b', fontWeight: 800 };
const actionBtnStyle: React.CSSProperties = { color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' };
const detailRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px', color: '#0f172a' };
const statusBtnStyle: React.CSSProperties = { padding: '15px', background: '#f8fafc', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', fontWeight: 800, color: '#0f172a', transition: 'all 0.2s' };