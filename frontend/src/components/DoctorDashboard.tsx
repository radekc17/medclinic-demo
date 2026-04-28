import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { format, isToday, parseISO, differenceInMinutes, isBefore, addMinutes, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

export function DoctorDashboard() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [dr, setDr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [detailsApp, setDetailsApp] = useState<any>(null);

  // --- STANY DLA PODGLĄDU HISTORII ---
  const [modalView, setModalView] = useState<'details' | 'history'>('details');
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySubTab, setHistorySubTab] = useState<'planned' | 'past'>('planned');

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userRes = await fetch('https://medclinic-demo.onrender.com/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
      const userData = await userRes.json();
      setDr(userData.doctorProfile);

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const appRes = await fetch(`https://medclinic-demo.onrender.com/doctors/me/appointments?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (appRes.ok) {
        const data = await appRes.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    let interval: any;
    if (isToday(currentDate)) { interval = setInterval(fetchData, 5000); }
    return () => clearInterval(interval);
  }, [currentDate]);

  useEffect(() => {
    const activeApp = appointments.find(a => a.status === 'IN_PROGRESS');
    if (activeApp && activeApp.startedAt && isToday(currentDate)) {
      const updateTimer = () => {
        const diff = differenceInMinutes(new Date(), parseISO(activeApp.startedAt));
        setElapsedTime(diff > 0 ? diff : 0);
      };
      updateTimer();
      const timer = setInterval(updateTimer, 60000);
      return () => clearInterval(timer);
    } else { setElapsedTime(0); }
  }, [appointments, currentDate]);

  const updateDr = async (payload: any) => {
    await fetch(`https://medclinic-demo.onrender.com/doctors/me/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(payload)
    });
    fetchData();
  };

  const handleStatusChange = async (id: number, action: 'call' | 'start' | 'end') => {
    if (!isToday(currentDate)) { toast.error("Tylko dzisiaj."); return; }
    if (action === 'call') {
        const app = appointments.find(a => a.id === id);
        if (app && isBefore(addMinutes(new Date(), 20), parseISO(app.date))) {
            if (!window.confirm(`Wizyta o ${format(parseISO(app.date), 'HH:mm')}. Wezwać wcześniej?`)) return;
        }
    }
    try {
        const res = await fetch(`https://medclinic-demo.onrender.com/doctors/appointments/${id}/${action}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            toast.success(action === 'call' ? '📢 Wezwano' : action === 'start' ? '🔵 Start' : '✅ Koniec');
            fetchData();
        }
    } catch (e) { toast.error('Błąd'); }
  };

  // --- NOWOŚĆ: RĘCZNE OZNACZENIE PACJENTA JAKO NIEOBECNEGO ---
  const handleAbsent = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz oznaczyć pacjenta jako nieobecnego? Zdejmie to wezwanie z ekranu TV.')) return;
    try {
      const res = await fetch(`https://medclinic-demo.onrender.com/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status: 'ABSENT' }) 
      });
      if (res.ok) {
        toast.success('⚠️ Pacjent oznaczony jako nieobecny');
        fetchData();
      }
    } catch (e) { toast.error('Błąd połączenia'); }
  };

  const fetchPatientHistory = async (pesel: string) => {
    setLoadingHistory(true);
    setModalView('history');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`https://medclinic-demo.onrender.com/appointments/guest-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pesel })
      });
      if (res.ok) {
        const data = await res.json();
        setPatientHistory(data);
      }
    } catch (e) { toast.error('Błąd pobierania historii'); }
    finally { setLoadingHistory(false); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Skopiowano'); };

  if (loading) return <div style={{padding:'20px'}}>Ładowanie...</div>;

  const isViewToday = isToday(currentDate);
  const completedList = appointments.filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'ABSENT');
  const activeList = appointments.filter(a => ['PENDING', 'CALLED', 'IN_PROGRESS'].includes(a.status));
  
  const activeAppCurrent = activeList.find(a => a.status === 'IN_PROGRESS');
  const calledAppCurrent = activeList.find(a => a.status === 'CALLED');
  const nextAppCurrent = activeList.find(a => a.status === 'PENDING');

  const displayedList = activeTab === 'active' ? activeList : completedList;

  const nowTime = new Date();
  const plannedHistory = patientHistory.filter(h => new Date(h.date) > nowTime && h.status !== 'CANCELLED');
  const pastHistory = patientHistory.filter(h => new Date(h.date) <= nowTime || h.status === 'CANCELLED');

  return (
    <div style={styles.container}>
      
      {/* MODAL KARTY PACJENTA */}
      {detailsApp && (
        <div style={styles.modalOverlay} onClick={() => { setDetailsApp(null); setModalView('details'); }}>
          <div style={{
            ...styles.modalCard, 
            maxWidth: modalView === 'details' ? '500px' : '850px', 
            minHeight: '400px',
            maxHeight: '80vh',
            display: 'flex', 
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{display:'flex', justifyContent:'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px'}}>
               <h3 style={{margin:0, color: 'var(--primary)'}}>{modalView === 'details' ? 'Karta Pacjenta' : 'Historia i Planowane Wizyty'}</h3>
               <button onClick={() => { setDetailsApp(null); setModalView('details'); }} style={styles.closeBtn}>&times;</button>
            </div>

            <div style={{flex: 1, overflowY: 'auto', padding: '15px 0'}}>
              {modalView === 'details' ? (
                <>
                  <div style={{marginBottom: '20px'}}>
                    <h2 style={{margin:'0 0 5px 0', color: 'var(--primary)'}}>{detailsApp.patient?.name || detailsApp.guestName}</h2>
                    <span style={{background: '#eff6ff', color: 'var(--accent)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                      {detailsApp.service?.name}
                    </span>
                  </div>
                  
                  <div style={styles.infoRow}><span>PESEL:</span><div style={{display:'flex', gap:'10px'}}><strong>{detailsApp.patient?.pesel || detailsApp.guestPesel || 'Brak'}</strong><button onClick={() => copyToClipboard(detailsApp.patient?.pesel || detailsApp.guestPesel)} style={styles.copyBtn}>KOPIUJ</button></div></div>
                  <div style={styles.infoRow}><span>Telefon:</span><strong>{detailsApp.patient?.phone || detailsApp.guestPhone || 'Brak'}</strong></div>

                  <div style={{marginTop: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                    <div style={styles.statsCard}>
                      <span style={styles.statsLabel}>Status Potwierdzenia</span>
                      <strong style={{color: detailsApp.isConfirmed ? '#059669' : '#ea580c'}}>
                        {detailsApp.isConfirmed ? '✅ Potwierdzone' : '⏳ Oczekuje'}
                      </strong>
                    </div>
                    <div style={styles.statsCard}>
                      <span style={styles.statsLabel}>Typ Pacjenta</span>
                      <strong style={{color: 'var(--primary)'}}>{detailsApp.patientId ? 'Zarejestrowany' : 'Gość'}</strong>
                    </div>
                  </div>

                  <button onClick={() => fetchPatientHistory(detailsApp.patient?.pesel || detailsApp.guestPesel)} style={{...styles.ctrlBtn, width: '100%', marginTop: '20px', borderColor: 'var(--accent)', color: 'var(--accent)', height: '45px', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.75rem'}}>
                    📂 Pełna historia i planowane wizyty
                  </button>

                  {detailsApp.status === 'COMPLETED' && (
                      <div style={{background:'#f8fafc', padding:'15px', borderRadius:'var(--radius)', marginTop:'20px', border: '1px solid #e2e8f0'}}>
                          <p style={{fontSize:'0.7rem', margin:'0 0 10px 0', textTransform:'uppercase', color:'var(--text-sub)', fontWeight:'800', letterSpacing: '0.5px'}}>Podsumowanie logistyczne</p>
                          {detailsApp.startedAt && detailsApp.endedAt && <div style={styles.infoRow}><span>Czas trwania wizyty:</span><strong>{differenceInMinutes(parseISO(detailsApp.endedAt), parseISO(detailsApp.startedAt))} min</strong></div>}
                          {detailsApp.startedAt && <div style={{...styles.infoRow, borderBottom:'none', color: '#b45309'}}><span>Opóźnienie startu:</span><strong>{differenceInMinutes(parseISO(detailsApp.startedAt), parseISO(detailsApp.date))} min</strong></div>}
                      </div>
                  )}
                </>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                   <button onClick={() => setModalView('details')} style={{marginBottom: '15px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem', textAlign: 'left', textTransform: 'uppercase'}}>← Powrót do danych pacjenta</button>
                   
                   <div style={{display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px'}}>
                      <button onClick={() => setHistorySubTab('planned')} style={{...styles.tabBtn, background: historySubTab === 'planned' ? 'var(--accent)' : 'var(--bg-app)', color: historySubTab === 'planned' ? 'white' : 'var(--text-sub)'}}>
                        📅 Zaplanowane ({plannedHistory.length})
                      </button>
                      <button onClick={() => setHistorySubTab('past')} style={{...styles.tabBtn, background: historySubTab === 'past' ? 'var(--accent)' : 'var(--bg-app)', color: historySubTab === 'past' ? 'white' : 'var(--text-sub)'}}>
                        📜 Historia ({pastHistory.length})
                      </button>
                   </div>

                   {loadingHistory ? <p style={{textAlign:'center', padding:'20px'}}>Ładowanie danych...</p> : (
                     <div style={{flex: 1, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 'var(--radius)'}}>
                       <table style={styles.table}>
                         <thead>
                           <tr style={styles.th}><th>DATA</th><th>USŁUGA</th><th>LEKARZ</th><th>STATUS</th></tr>
                         </thead>
                         <tbody>
                           {(historySubTab === 'planned' ? plannedHistory : pastHistory).map(h => (
                             <tr key={h.id} style={styles.tr}>
                               <td style={styles.timeTd}>{format(parseISO(h.date), 'dd.MM.yyyy HH:mm')}</td>
                               <td style={styles.serviceTd}>{h.service?.name}</td>
                               <td style={styles.nameTd}>{h.doctor?.user?.name}</td>
                               <td style={{...styles.statusTd, color: h.status === 'CANCELLED' ? '#ef4444' : '#059669', fontWeight: '700'}}>
                                 {h.status === 'CANCELLED' ? 'ODWOŁANA' : historySubTab === 'planned' ? 'ZAPLANOWANA' : 'ZAKOŃCZONA'}
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   )}
                </div>
              )}
            </div>
            
            <div style={{borderTop: '1px solid #f1f5f9', paddingTop: '15px'}}>
              <button style={styles.mainBtn} onClick={() => { setDetailsApp(null); setModalView('details'); }}>ZAMKNIJ</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.drInfo}>
          <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'5px'}}>
              <button onClick={() => setCurrentDate(addDays(currentDate, -1))} style={styles.arrowBtn}>◀</button>
              <h2 style={{margin:0, fontSize: '1.2rem', color: isViewToday ? 'var(--primary)' : 'var(--text-sub)', fontWeight: '800'}}>{format(currentDate, 'eeee, d MMMM', { locale: pl })}</h2>
              <button onClick={() => setCurrentDate(addDays(currentDate, 1))} style={styles.arrowBtn}>▶</button>
              {!isViewToday && <button onClick={() => setCurrentDate(new Date())} style={styles.todayBtn}>WRÓĆ DO DZIŚ</button>}
          </div>
          <div style={styles.statusPill}>
            <div style={{...styles.dot, backgroundColor: dr?.workStatus === 'AVAILABLE' ? '#10b981' : dr?.workStatus === 'WORK_INTERNAL' ? '#f59e0b' : '#ef4444'}}></div>
            <span style={styles.statusText}>{dr?.workStatus === 'AVAILABLE' ? 'DOSTĘPNY' : dr?.workStatus === 'WORK_INTERNAL' ? 'PRACA WEWN.' : 'PRZERWA'}</span>
          </div>
        </div>
        <div style={styles.controls}>
          <button onClick={() => updateDr({ workStatus: dr?.workStatus === 'WORK_INTERNAL' ? 'AVAILABLE' : 'WORK_INTERNAL' })} style={{...styles.ctrlBtn, color: '#b45309', borderColor: '#f59e0b'}}>{dr?.workStatus === 'WORK_INTERNAL' ? '🔓 WZNAWIAJ' : '🔒 PRACA WEWN.'}</button>
          <button onClick={() => updateDr({ isOnBreak: !dr?.isOnBreak, workStatus: !dr?.isOnBreak ? 'BREAK' : 'AVAILABLE' })} style={{...styles.ctrlBtn, color: '#b91c1c', borderColor: '#ef4444'}}>{dr?.isOnBreak ? '▶️ KONIEC' : '☕ PRZERWA'}</button>
          <div style={styles.delayDisplay}>⚠️ POŚLIZG: {dr?.currentDelay > 0 ? dr.currentDelay : 0} MIN (AUTO)</div>
        </div>
      </div>

      <div style={styles.layout}>
        {/* TABELA WIZYT */}
        <div style={styles.tableCard}>
          <div style={{padding:'12px 15px', background:'var(--bg-card)', borderBottom:'1px solid #e2e8f0', color: activeTab === 'active' ? 'var(--accent)' : 'var(--text-sub)', fontSize:'0.7rem', fontWeight:'800', letterSpacing:'1px', textTransform: 'uppercase'}}>
            {activeTab === 'active' ? 'Pacjenci do przyjęcia' : 'Historia wizyt (zrealizowane)'}
          </div>
          <table style={styles.table}>
            <thead>
              <tr style={styles.th}><th style={{width:'60px'}}>GODZ.</th><th>PACJENT</th><th>USŁUGA</th><th style={{width:'120px'}}>STATUS</th><th style={{width:'80px'}}>AKCJA</th></tr>
            </thead>
            <tbody>
              {displayedList.length === 0 ? (
                <tr><td colSpan={5} style={{padding:'40px', textAlign:'center', color:'var(--text-sub)'}}>{activeTab === 'active' ? 'Brak pacjentów w poczekalni.' : 'Brak wizyt.'}</td></tr>
              ) : (
                displayedList.map((app) => (
                    <tr key={app.id} style={{...styles.tr, backgroundColor: app.status === 'IN_PROGRESS' ? '#f0fdf4' : app.status === 'CALLED' ? '#fff7ed' : 'transparent', opacity: ['CANCELLED', 'ABSENT'].includes(app.status) ? 0.5 : 1}} onClick={() => setDetailsApp(app)}>
                      <td style={styles.timeTd}>{format(parseISO(app.date), 'HH:mm')}</td>
                      <td style={styles.nameTd}>{app.patient?.name || app.guestName}</td>
                      <td style={styles.serviceTd}>{app.service?.name}</td>
                      <td style={styles.statusTd}>
                        <span style={{fontWeight: '800', color: app.status === 'IN_PROGRESS' ? '#059669' : app.status === 'CALLED' ? '#c2410c' : app.status === 'ABSENT' ? '#ef4444' : 'inherit', fontSize: '10px', textTransform: 'uppercase'}}>
                          {app.status === 'IN_PROGRESS' ? '🔵 W gabinecie' : 
                           app.status === 'CALLED' ? '📢 Wezwany' : 
                           app.status === 'PENDING' ? 'Oczekuje' : 
                           app.status === 'CANCELLED' ? 'Odwołana' : 
                           app.status === 'ABSENT' ? '❌ Nieobecny' : '✅ Koniec'}
                        </span>
                      </td>
                      <td style={styles.actionTd} onClick={e => e.stopPropagation()}>
                         {activeTab === 'active' && isViewToday && app.status === 'PENDING' && <button onClick={() => handleStatusChange(app.id, 'call')} style={styles.iconBtn}>🔔</button>}
                         {activeTab === 'active' && isViewToday && app.status === 'CALLED' && <button onClick={() => handleStatusChange(app.id, 'start')} style={styles.iconBtn}>▶️</button>}
                         {activeTab === 'active' && isViewToday && app.status === 'IN_PROGRESS' && <button onClick={() => handleStatusChange(app.id, 'end')} style={styles.iconBtn}>✅</button>}
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BAZA AKCJI (PRAWY PANEL) */}
        <div style={styles.sidePanel}>
          {!isViewToday ? (
              <div style={{...styles.callBox, background: 'var(--bg-card)', border:'1px dashed var(--text-sub)', color:'var(--text-sub)'}}><h3>Tryb Podglądu</h3><p>Dzień: <strong>{format(currentDate, 'dd.MM.yyyy')}</strong></p><button onClick={() => setCurrentDate(new Date())} style={{...styles.mainBtn, background:'var(--text-sub)'}}>WRÓĆ DO DZISIAJ</button></div>
          ) : (
              <>
                {activeAppCurrent ? (
                    <div style={{...styles.callBox, borderColor: '#059669', background: '#f0fdf4'}}><span style={{...styles.label, color: '#059669'}}>Pacjent w gabinecie</span><div style={styles.timerBadge}>Czas: {elapsedTime} min</div><div style={styles.bigName}>{activeAppCurrent.patient?.name || activeAppCurrent.guestName}</div><button onClick={() => handleStatusChange(activeAppCurrent.id, 'end')} style={{...styles.mainBtn, background: '#059669'}}>✅ Zakończ wizytę</button></div>
                ) : calledAppCurrent ? (
                    <div style={{...styles.callBox, borderColor: '#f97316', background: '#fff7ed'}}>
                        <span style={{...styles.label, color: '#c2410c'}}>📢 Pacjent wezwany</span>
                        <div style={styles.bigName}>{calledAppCurrent.patient?.name || calledAppCurrent.guestName}</div>
                        <button onClick={() => handleStatusChange(calledAppCurrent.id, 'start')} style={{...styles.mainBtn, background: '#f97316', marginBottom: '10px'}}>▶️ Pacjent wszedł</button>
                        <button onClick={() => handleAbsent(calledAppCurrent.id)} style={{...styles.mainBtn, background: 'transparent', border: '2px solid #ef4444', color: '#ef4444'}}>❌ Pacjent nieobecny</button>
                    </div>
                ) : (
                    <div style={{...styles.callBox, opacity: dr?.workStatus !== 'AVAILABLE' ? 0.6 : 1, borderColor: 'var(--accent)'}}><span style={styles.label}>Następny pacjent</span>{nextAppCurrent ? <><div style={styles.bigTime}>{format(parseISO(nextAppCurrent.date), 'HH:mm')}</div><div style={styles.bigName}>{nextAppCurrent.patient?.name || nextAppCurrent.guestName}</div><button disabled={dr?.workStatus !== 'AVAILABLE'} onClick={() => handleStatusChange(nextAppCurrent.id, 'call')} style={styles.mainBtn}>{dr?.workStatus === 'AVAILABLE' ? '🔔 Wezwij do gabinetu' : 'System zablokowany'}</button></> : <div style={styles.empty}>Brak kolejnych wizyt.</div>}</div>
                )}
              </>
          )}
          <div style={styles.summaryGrid}>
              <div style={{...styles.summaryItem, cursor:'pointer', background: activeTab === 'history' ? 'var(--bg-app)' : 'white', borderColor: activeTab === 'history' ? 'var(--text-sub)' : '#e2e8f0', borderWidth: activeTab === 'history' ? '2px' : '1px'}} onClick={() => setActiveTab('history')}><span style={styles.sumLabel}>Zrealizowano</span><span style={{...styles.sumVal, color: activeTab === 'history' ? 'var(--primary)' : '#059669'}}>{completedList.length}</span></div>
              <div style={{...styles.summaryItem, cursor:'pointer', background: activeTab === 'active' ? '#eff6ff' : 'white', borderColor: activeTab === 'active' ? 'var(--accent)' : '#e2e8f0', borderWidth: activeTab === 'active' ? '2px' : '1px'}} onClick={() => setActiveTab('active')}><span style={styles.sumLabel}>Do przyjęcia</span><span style={{...styles.sumVal, color: activeTab === 'active' ? '#1e3a8a' : 'var(--accent)'}}>{activeList.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  container: { padding: '20px', backgroundColor: 'var(--bg-app)', minHeight: '100vh', fontSize: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '15px 25px', borderRadius: 'var(--radius)', marginBottom: '20px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' },
  drInfo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  statusPill: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', width: 'fit-content' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  statusText: { fontSize: '10px', fontWeight: '800', color: 'var(--text-sub)', letterSpacing: '0.5px' },
  controls: { display: 'flex', gap: '10px', alignItems:'center' },
  ctrlBtn: { padding: '8px 16px', background: 'white', border: '1px solid', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '800', fontSize: '11px', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' },
  delayDisplay: { padding: '8px 16px', background: '#fff7ed', border: '1px solid #ffedd5', color: '#9a3412', borderRadius: 'var(--radius)', fontWeight: '800', fontSize: '11px', display:'flex', alignItems:'center', cursor:'default' },
  arrowBtn: { background: 'none', border: '1px solid #cbd5e1', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '1rem', padding: '2px 10px', color: 'var(--primary)' },
  todayBtn: { fontSize: '0.7rem', fontWeight: '800', background: 'var(--bg-app)', border: 'none', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', color: 'var(--text-sub)', textTransform: 'uppercase' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' },
  tableCard: { background: 'white', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', overflow: 'hidden', minHeight:'400px', boxShadow: 'var(--shadow-sm)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', background: '#f8fafc', color: 'var(--text-sub)', fontSize: '10px', padding: '12px 15px', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s', cursor:'pointer' },
  timeTd: { padding: '12px 15px', fontWeight: '800', color: 'var(--primary)' },
  nameTd: { padding: '12px 15px', fontWeight: '600', color: 'var(--primary)' },
  serviceTd: { padding: '12px 15px', color: 'var(--text-sub)', fontSize: '13px' },
  statusTd: { padding: '12px 15px' },
  actionTd: { padding: '12px 15px', textAlign: 'center' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 8px', transition: 'transform 0.2s' },
  sidePanel: { display: 'flex', flexDirection: 'column', gap: '20px' },
  callBox: { background: '#fff', padding: '25px', borderRadius: 'var(--radius)', border: '2px solid var(--accent)', textAlign: 'center', transition: 'all 0.3s', boxShadow: 'var(--shadow-md)' },
  label: { fontSize: '10px', color: 'var(--text-sub)', fontWeight: '800', display: 'block', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' },
  timerBadge: { background: '#ecfdf5', color: '#059669', padding: '5px 12px', borderRadius: '20px', display: 'inline-block', fontSize: '11px', fontWeight: '800', margin: '12px 0', border: '1px solid #d1fae5' },
  bigTime: { fontSize: '2.8rem', fontWeight: '900', color: 'var(--primary)', margin: '5px 0', letterSpacing: '-1px' },
  bigName: { fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px', color: 'var(--primary)', lineHeight: '1.2' },
  mainBtn: { width: '100%', padding: '16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  summaryItem: { background: 'white', padding: '20px', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px solid #e2e8f0', transition:'all 0.2s', boxShadow: 'var(--shadow-sm)' },
  sumLabel: { display: 'block', fontSize: '9px', color: 'var(--text-sub)', marginBottom: '6px', fontWeight:'800', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sumVal: { fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-1px' },
  empty: { padding: '20px', color: 'var(--text-sub)', fontStyle: 'italic', fontSize: '13px' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' },
  modalCard: { background: 'white', padding: '30px', borderRadius: 'var(--radius)', width: '90%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', transition: 'all 0.3s ease-in-out', border: '1px solid #e2e8f0' },
  closeBtn: { background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: 'var(--text-sub)', lineHeight: '1' },
  infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: 'var(--text-main)' },
  copyBtn: { background: 'var(--bg-app)', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: '800', color: 'var(--text-sub)', textTransform: 'uppercase' },
  tabBtn: { flex: 1, padding: '12px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: '800', fontSize: '0.75rem', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statsCard: { background: '#f8fafc', padding: '15px', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', textAlign: 'center' },
  statsLabel: { display: 'block', fontSize: '0.65rem', color: 'var(--text-sub)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }
};