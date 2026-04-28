import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ScheduleSettingsModal } from './ScheduleSettingsModal';

// =============================================================================
// 1. KONFIGURACJA I STAŁE
// =============================================================================

const REQUEST_DEADLINE_DAY = 32; // Np. do 15-go dnia miesiąca

// =============================================================================
// 2. TYPY DANYCH (INTERFEJSY)
// =============================================================================

interface WorkShift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'DRAFT' | 'PUBLISHED';
  type: 'WORK' | 'OVERTIME';
  note?: string; 
  user: { id: number; name: string };
  room?: { id: number; name: string; clinic?: { id: number; name: string } }; // <--- DODANO CLINIC
}

interface RequestItem {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  user: { name: string };
  createdAt: string;
}

interface StaffMember { 
    id: number; 
    name: string; 
    role: string; 
    email: string; 
}

interface Props { 
    userRole: string; 
    userId: number; 
}

// =============================================================================
// 3. HELPERS (POMOCNICZE)
// =============================================================================

// FIX CZASOWY: Wyciąga godzinę "HH:mm" bezpośrednio ze stringa ISO.
// Zapobiega przesuwaniu czasu przez strefy czasowe przeglądarki (np. 7:00 -> 8:00).
const getRawTime = (isoString: string) => {
    if (!isoString) return '00:00';
    // Format ISO z bazy: "2024-05-20T07:00:00.000Z"
    // Dzielimy po 'T' i bierzemy pierwsze 5 znaków czasu
    return isoString.split('T')[1].substring(0, 5);
};

// KOMPONENT TOOLTIP (Dymek z podpowiedzią)
const TooltipWrapper = ({ text, children }: { text: string, children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);
    
    return (
        <div 
            style={{position: 'relative', display: 'flex', alignItems: 'center'}}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div style={styles.tooltip}>
                    {text}
                    <div style={styles.tooltipArrow}></div>
                </div>
            )}
        </div>
    );
};

// =============================================================================
// 4. GŁÓWNY KOMPONENT
// =============================================================================

export function SchedulePanel({ userRole, userId }: Props) {
  
  // --- STATE: DATA I DANE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- STATE: NOWE ZAKŁADKI (MIASTA) ---
  const [selectedClinic, setSelectedClinic] = useState<string>('ALL');
  const [clinicsList, setClinicsList] = useState<any[]>([]);
  const [myClinicId, setMyClinicId] = useState<number | null>(null);

  // --- STATE: MODALE ---
  const [showSettings, setShowSettings] = useState(false);
  const [showRequestsList, setShowRequestsList] = useState(false); 
  const [showManualEdit, setShowManualEdit] = useState<{date: Date, shift?: WorkShift} | null>(null); 
  const [showBulkModal, setShowBulkModal] = useState<'WORK' | 'ABSENCE' | null>(null);
  const [showDayDetails, setShowDayDetails] = useState<Date | null>(null);

  // --- STATE: MALOWANIE (SELECTION) ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);
  
  // Manager wybiera kogo edytuje (null = Siebie)
  const [paintTargetId, setPaintTargetId] = useState<number | null>(null);

  // --- STATE: DANE POMOCNICZE (API) ---
  const [pendingRequests, setPendingRequests] = useState<RequestItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]); 
  const [roomsList, setRoomsList] = useState<any[]>([]);

  // --- STATE: FORMULARZ BULK ---
  const [bulkStart, setBulkStart] = useState('07:00');
  const [bulkEnd, setBulkEnd] = useState('15:00');
  const [bulkReason, setBulkReason] = useState('');
  const [absenceType, setAbsenceType] = useState('VACATION');
  const [bulkRoomId, setBulkRoomId] = useState<number | ''>(''); 

  const isManager = ['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(userRole);
  const canRequestWork = () => new Date().getDate() <= REQUEST_DEADLINE_DAY;

  // ===========================================================================
  // 5. API CALLS (POBIERANIE DANYCH)
  // ===========================================================================

  const fetchInitialConfig = async () => {
      try {
          const [meRes, clinRes] = await Promise.all([
              fetch('http://localhost:3000/users/me', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
              fetch('http://localhost:3000/clinics')
          ]);
          if (meRes.ok) {
              const meData = await meRes.json();
              setMyClinicId(meData.clinicId || null);
          }
          if (clinRes.ok) {
              setClinicsList(await clinRes.json());
          }
      } catch (e) { console.error(e); }
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
      if (!isManager) params.append('userId', userId.toString());

      const res = await fetch(`http://localhost:3000/schedule?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setShifts(await res.json());
    } catch (err) { toast.error("Błąd pobierania grafiku"); } 
    finally { setLoading(false); }
  };

  const fetchPendingRequests = async () => {
      try {
          const res = await fetch('http://localhost:3000/schedule/requests', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if(res.ok) setPendingRequests(await res.json());
      } catch(e) {}
  };

  const fetchHelpers = async () => {
      const uRes = await fetch('http://localhost:3000/users/staff', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if(uRes.ok) setStaffList(await uRes.json());
      const rRes = await fetch('http://localhost:3000/schedule/rooms');
      if(rRes.ok) setRoomsList(await rRes.json());
  };

  useEffect(() => {
    fetchInitialConfig();
    fetchSchedule();
    if (isManager) {
        fetchPendingRequests();
        fetchHelpers();
    }
    const handleGlobalMouseUp = () => setDragMode(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [currentDate]);

  // ===========================================================================
  // 6. INTERAKCJA: MALOWANIE I SELECTION
  // ===========================================================================

  const updateSelection = (dateStr: string, mode: 'select' | 'deselect') => {
      setSelectedDates(prev => {
          const next = new Set(prev);
          if (mode === 'select') next.add(dateStr);
          else next.delete(dateStr);
          return next;
      });
  };

  const handleMouseDown = (dateStr: string) => {
      if (!isSelectionMode) return;
      const isAlreadySelected = selectedDates.has(dateStr);
      const newMode = isAlreadySelected ? 'deselect' : 'select';
      setDragMode(newMode);
      updateSelection(dateStr, newMode);
  };

  const handleMouseEnter = (dateStr: string) => {
      if (!isSelectionMode || !dragMode) return;
      updateSelection(dateStr, dragMode);
  };

  // ===========================================================================
  // 7. INTERAKCJA: BULK ACTIONS (MASOWE WSTAWIANIE)
  // ===========================================================================

  const openBulkModal = (type: 'WORK' | 'ABSENCE') => {
      if (selectedDates.size === 0) return toast.error("Najpierw zaznacz dni na kalendarzu!");
      setBulkStart('07:00');
      setBulkEnd('15:00');
      setBulkReason('');
      setAbsenceType('VACATION'); 
      setBulkRoomId('');
      setShowBulkModal(type);
  };

  const confirmBulkSubmit = async () => {
      const datesArray = Array.from(selectedDates);
      const isDirectPainting = isManager && paintTargetId !== null;
      
      // SCENARIUSZ A: MANAGER WSTAWIA PRACĘ (Shift)
      if (isDirectPainting && showBulkModal === 'WORK') {
          try {
             const res = await fetch('http://localhost:3000/schedule/shift/bulk', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                 body: JSON.stringify({
                     userId: paintTargetId,
                     dates: datesArray,
                     start: bulkStart,
                     end: bulkEnd,
                     roomId: bulkRoomId ? Number(bulkRoomId) : undefined 
                 })
             });
             
             if (res.ok) {
                 const data = await res.json();
                 if (data.warnings && data.warnings.length > 0) {
                     toast(data.warnings[0], { icon: '⚠️' });
                 } else {
                     toast.success("Grafik zaktualizowany");
                 }
                 finalizeBulk();
             } else {
                 const err = await res.json();
                 toast.error(err.message || "Błąd zapisu");
             }
          } catch(e) { toast.error("Błąd zapisu zmian"); }

      } else {
          // SCENARIUSZ B: WNIOSEK / NIEOBECNOŚĆ (L4/URLOP)
          const typeToSend = showBulkModal === 'WORK' ? 'WORK_PREFERENCE' : absenceType;
          try {
              const res = await fetch('http://localhost:3000/schedule/request/bulk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                  body: JSON.stringify({
                      type: typeToSend,
                      dates: datesArray,
                      reason: bulkReason,
                      startHour: showBulkModal === 'WORK' ? bulkStart : undefined,
                      endHour: showBulkModal === 'WORK' ? bulkEnd : undefined,
                      targetUserId: isDirectPainting ? paintTargetId : undefined 
                  })
              });
              if (res.ok) {
                  toast.success(isDirectPainting ? "Zapisano!" : "Wniosek wysłany!");
                  finalizeBulk();
              }
          } catch (e) { toast.error("Błąd wysyłania"); }
      }
  };
  
  const finalizeBulk = () => {
      setIsSelectionMode(false);
      setSelectedDates(new Set());
      setShowBulkModal(null);
      fetchSchedule();
      if(isManager) fetchPendingRequests();
  };

  // ===========================================================================
  // 8. INTERAKCJA: EDYCJA POJEDYNCZA, SZYBKA ZMIANA, USUWANIE
  // ===========================================================================

  const handleQuickRoomChange = async (shift: WorkShift, newRoomId: string) => {
      try {
          const res = await fetch('http://localhost:3000/schedule/shift', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({
                  id: shift.id,
                  userId: shift.user.id,
                  date: shift.date.split('T')[0],
                  // UŻYWAMY getRawTime ABY NIE ZEPSUĆ GODZINY
                  start: getRawTime(shift.startTime),
                  end: getRawTime(shift.endTime),
                  roomId: newRoomId ? Number(newRoomId) : undefined
              })
          });
          if(res.ok) {
              toast.success("Zmieniono gabinet");
              fetchSchedule();
          }
      } catch(e) { toast.error("Błąd zmiany gabinetu"); }
  };

  const handleDeleteShift = async (shiftId: number) => {
      if (!window.confirm("Czy na pewno chcesz usunąć tę zmianę?")) return;
      try {
          const res = await fetch(`http://localhost:3000/schedule/shift/${shiftId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) {
              toast.success("Zmiana usunięta");
              fetchSchedule();
          } else {
              toast.error("Błąd usuwania");
          }
      } catch(e) { toast.error("Błąd połączenia"); }
  };

  const handleManualSave = async (e: any) => {
      e.preventDefault();
      if (!showManualEdit) return;
      const form = e.target;
      try {
          const res = await fetch('http://localhost:3000/schedule/shift', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({
                  id: showManualEdit.shift?.id, // ID DLA EDYCJI (Jeśli null, backend stworzy nową)
                  userId: Number(form.userId.value),
                  date: format(showManualEdit.date, 'yyyy-MM-dd'),
                  start: form.start.value,
                  end: form.end.value,
                  roomId: form.roomId.value ? Number(form.roomId.value) : undefined
              })
          });
          if (res.ok) {
              toast.success("Zapisano zmianę");
              setShowManualEdit(null);
              fetchSchedule();
          } else {
              const err = await res.json();
              toast.error(err.message || "Błąd. Może kolizja godzin?");
          }
      } catch(e) { toast.error("Błąd zapisu"); }
  };

  // ===========================================================================
  // 9. INTERAKCJA: WNIOSKI I ZARZĄDZANIE GRAFIKIEM (Manager)
  // ===========================================================================

  const handleResolveAll = async () => {
      if (!window.confirm("Zatwierdzić WSZYSTKIE oczekujące wnioski?")) return;
      try {
          const res = await fetch('http://localhost:3000/schedule/requests/resolve-all', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) {
              const data = await res.json();
              toast.success(`Zatwierdzono ${data.count} wniosków!`);
              fetchPendingRequests();
              fetchSchedule();
          }
      } catch(e) { toast.error("Błąd operacji"); }
  };

  const handleResolveRequest = async (id: number, status: 'APPROVED' | 'REJECTED') => {
      try {
          const res = await fetch(`http://localhost:3000/schedule/requests/${id}/resolve`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({ status })
          });
          if (res.ok) {
              toast.success(status === 'APPROVED' ? "Zatwierdzono" : "Odrzucono");
              fetchPendingRequests();
              fetchSchedule(); 
          }
      } catch(e) { toast.error("Błąd"); }
  };

  const handleGenerate = async () => {
    if (!window.confirm(`Wygenerować grafik na ${format(currentDate, 'MMMM', {locale: pl})}?`)) return;
    setLoading(true);
    try {
        await fetch('http://localhost:3000/schedule/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 })
        });
        toast.success("Wygenerowano grafik (DRAFT)");
        fetchSchedule();
    } catch(e) { toast.error("Błąd generowania"); setLoading(false); }
  };

  const handlePublish = async () => {
    const draftIds = shifts.filter(s => s.status === 'DRAFT').map(s => s.id);
    if (draftIds.length === 0) return toast("Brak zmian do publikacji");
    if (!window.confirm(`Opublikować ${draftIds.length} zmian?`)) return;
    try {
        await fetch('http://localhost:3000/schedule/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ ids: draftIds })
        });
        toast.success("Grafik opublikowany!");
        fetchSchedule();
    } catch(e) { toast.error("Błąd publikacji"); }
  };

  // ===========================================================================
  // 10. RENDEROWANIE WIDOKU (JSX)
  // ===========================================================================

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const emptyDays = Array.from({ length: getDay(startOfMonth(currentDate)) === 0 ? 6 : getDay(startOfMonth(currentDate)) - 1 });

  // --- FILTROWANIE WIDOKU ZMIAN (KLATKA HALINKI + ZAKŁADKI) ---
  const displayedShifts = shifts.filter(s => {
      // Jeśli pracownik ma przypisaną klinikę na sztywno (np. Halinka)
      if (myClinicId) {
          if (s.room?.clinic?.id === myClinicId) return true;
          if (!s.room) return true; // Pokazujemy L4 i urlopy, żeby wiedziała kogo nie ma
          return false;
      }
      // Jeśli to Admin/Manager (korzysta z zakładek)
      if (selectedClinic === 'ALL') return true;
      if (!s.room) return true; // Pokazujemy urlopy w każdej zakładce
      return s.room?.clinic?.name === selectedClinic;
  });

  return (
    <div style={{padding: '10px 20px', maxWidth: '1200px', margin: '0 auto'}}>
      {showSettings && <ScheduleSettingsModal onClose={() => setShowSettings(false)} />}
      
      {/* MODAL 1: BULK ACTIONS */}
      {showBulkModal && (
          <div className="modal-overlay" onClick={() => setShowBulkModal(null)}>
              <div className="modal-content sharp-card" style={{maxWidth:'450px'}} onClick={e => e.stopPropagation()}>
                  <h3>{showBulkModal === 'WORK' ? (isManager && paintTargetId ? '🛠️ Ustaw Zmiany' : '🙋 Dyspozycyjność') : '🏥 Zgłoś Nieobecność'}</h3>
                  <p style={{marginBottom:'15px', color:'#666'}}>Wybrano dni: <strong style={{color:'#2563eb', fontSize:'1.2rem'}}>{selectedDates.size}</strong></p>
                  <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                      {showBulkModal === 'ABSENCE' && (
                          <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>Typ Nieobecności:
                              <select value={absenceType} onChange={e => setAbsenceType(e.target.value)} style={{...styles.input, marginTop:'5px', borderColor:'#f59e0b'}}>
                                  <option value="VACATION">🏖️ Urlop Wypoczynkowy</option>
                                  <option value="SICK_LEAVE">🚑 L4 (Zwolnienie Lekarskie)</option>
                                  <option value="ON_DEMAND">⚠️ Urlop Na Żądanie</option>
                              </select>
                          </label>
                      )}
                      {showBulkModal === 'WORK' && (
                          <>
                              <div style={{display:'flex', gap:'10px', background:'#f8fafc', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                                  <div style={{flex:1}}>
                                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#475569'}}>Od:</label>
                                      <input type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} style={styles.input} />
                                  </div>
                                  <div style={{flex:1}}>
                                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#475569'}}>Do:</label>
                                      <input type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} style={styles.input} />
                                  </div>
                              </div>
                              {isManager && paintTargetId && (
                                  <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>Domyślny Gabinet:
                                      <select value={bulkRoomId} onChange={e => setBulkRoomId(e.target.value ? Number(e.target.value) : '')} style={styles.input}>
                                          <option value="">-- Brak / Dowolny --</option>
                                          {roomsList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                      </select>
                                  </label>
                              )}
                          </>
                      )}
                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#475569'}}>Notatka:</label>
                      <input type="text" value={bulkReason} onChange={e => setBulkReason(e.target.value)} style={styles.input} placeholder="..." />
                      <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                          <button onClick={confirmBulkSubmit} style={{...styles.btnGen, flex:1, fontSize:'1rem'}}>Zatwierdź</button>
                          <button onClick={() => setShowBulkModal(null)} style={{...styles.btnSettings, flex:1}}>Anuluj</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL 2: DAY DETAILS */}
      {showDayDetails && (
          <div className="modal-overlay" onClick={() => setShowDayDetails(null)}>
              <div className="modal-content sharp-card" style={{width:'600px', maxWidth:'95%'}} onClick={e => e.stopPropagation()}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'15px'}}>
                      <h3 style={{margin:0}}>📅 Plan na dzień {format(showDayDetails, 'dd.MM.yyyy')}</h3>
                      <button className="btn-close" onClick={() => setShowDayDetails(null)}>×</button>
                  </div>
                  <div style={{maxHeight:'400px', overflowY:'auto'}}>
                      {displayedShifts.filter(s => isSameDay(parseISO(s.date), showDayDetails)).length === 0 ? (
                          <p style={{textAlign:'center', color:'#94a3b8'}}>Brak zaplanowanych zmian.</p>
                      ) : (
                          <table style={{width:'100%', borderCollapse:'collapse'}}>
                              <thead>
                                  <tr style={{textAlign:'left', color:'#64748b', fontSize:'0.8rem', borderBottom:'2px solid #f1f5f9'}}>
                                      <th style={{padding:'8px'}}>Pracownik</th>
                                      <th style={{padding:'8px'}}>Godziny</th>
                                      <th style={{padding:'8px'}}>Gabinet</th>
                                      <th style={{padding:'8px'}}>Akcja</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {displayedShifts.filter(s => isSameDay(parseISO(s.date), showDayDetails)).map(shift => {
                                      const isAbsence = ['VACATION', 'SICK_LEAVE'].includes(shift.note || '');
                                      return (
                                          <tr key={shift.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                                              <td style={{padding:'8px', fontWeight:'bold'}}>{shift.user.name}</td>
                                              <td style={{padding:'8px'}}>
                                                  {isAbsence ? (
                                                      <span style={{color: shift.note==='VACATION'?'#d97706':'#7c3aed', fontWeight:'bold', fontSize:'0.8rem'}}>
                                                          {shift.note === 'VACATION' ? '🏖️ Urlop' : '🚑 L4'}
                                                      </span>
                                                  ) : (
                                                      // FIX WYŚWIETLANIA: UŻYWAMY getRawTime
                                                      `${getRawTime(shift.startTime)} - ${getRawTime(shift.endTime)}`
                                                  )}
                                              </td>
                                              <td style={{padding:'8px'}}>
                                                  {!isAbsence && (
                                                      <select 
                                                          value={shift.room?.id || ''} 
                                                          onChange={(e) => handleQuickRoomChange(shift, e.target.value)}
                                                          style={{padding:'4px', borderRadius:'4px', border:'1px solid #cbd5e1', fontSize:'0.85rem', width:'100%'}}
                                                      >
                                                          <option value="">-- Brak --</option>
                                                          {roomsList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                      </select>
                                                  )}
                                              </td>
                                              <td style={{padding:'8px', display:'flex', gap:'5px'}}>
                                                  <TooltipWrapper text="Edytuj zmianę">
                                                      <button 
                                                          onClick={() => { setShowDayDetails(null); setShowManualEdit({date: showDayDetails, shift}); }} 
                                                          style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem'}}
                                                      >
                                                          ✏️
                                                      </button>
                                                  </TooltipWrapper>
                                                  <TooltipWrapper text="Usuń zmianę">
                                                      <button 
                                                          onClick={() => handleDeleteShift(shift.id)}
                                                          style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem'}}
                                                      >
                                                          🗑️
                                                      </button>
                                                  </TooltipWrapper>
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      )}
                  </div>
                  <div style={{marginTop:'20px', textAlign:'right'}}>
                      <TooltipWrapper text="Dodaj kolejną zmianę (np. po południu)">
                          <button onClick={() => { setShowDayDetails(null); setShowManualEdit({ date: showDayDetails }); }} style={{...styles.btnGen, fontSize:'0.9rem'}}>+ Dodaj Zmianę</button>
                      </TooltipWrapper>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL 3: MANUAL EDIT */}
      {showManualEdit && (
          <div className="modal-overlay" onClick={() => setShowManualEdit(null)}>
              <div className="modal-content sharp-card" onClick={e => e.stopPropagation()}>
                  <h3>✏️ Edycja: {format(showManualEdit.date, 'dd.MM.yyyy')}</h3>
                  <form onSubmit={handleManualSave} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                      <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>Pracownik:
                          <select name="userId" defaultValue={showManualEdit.shift?.user.id} style={styles.input} required>
                              <option value="">-- Wybierz --</option>
                              {staffList.map(d => <option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
                          </select>
                      </label>
                      <div style={{display:'flex', gap:'10px'}}>
                          <div style={{flex:1}}>
                              <label style={{fontSize:'0.8rem'}}>Start:</label>
                              <input 
                                  type="time" 
                                  name="start" 
                                  // FIX EDYCJI: Używamy getRawTime jako defaultValue
                                  defaultValue={showManualEdit.shift ? getRawTime(showManualEdit.shift.startTime) : '07:00'} 
                                  style={styles.input} 
                                  required 
                              />
                          </div>
                          <div style={{flex:1}}>
                              <label style={{fontSize:'0.8rem'}}>Koniec:</label>
                              <input 
                                  type="time" 
                                  name="end" 
                                  defaultValue={showManualEdit.shift ? getRawTime(showManualEdit.shift.endTime) : '15:00'} 
                                  style={styles.input} 
                                  required 
                              />
                          </div>
                      </div>
                      <label style={{fontSize:'0.9rem'}}>Gabinet:
                          <select name="roomId" defaultValue={showManualEdit.shift?.room?.id} style={styles.input}>
                              <option value="">-- Brak / Dowolny --</option>
                              {roomsList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                      </label>
                      <button type="submit" style={styles.btnGen}>Zapisz</button>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL 4: REQUESTS LIST */}
      {showRequestsList && (
          <div className="modal-overlay" onClick={() => setShowRequestsList(false)}>
              <div className="modal-content sharp-card" style={{maxWidth:'600px'}} onClick={e => e.stopPropagation()}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                      <h3 style={{margin:0}}>📬 Wnioski ({pendingRequests.length})</h3>
                      {pendingRequests.length > 0 && (
                          <button onClick={handleResolveAll} style={{...styles.btnPub, fontSize:'0.8rem', background:'#16a34a'}}>✅ Akceptuj Wszystkie</button>
                      )}
                  </div>
                  {pendingRequests.length === 0 ? <p style={{color:'#94a3b8', textAlign:'center', padding:'20px'}}>Brak oczekujących wniosków.</p> : (
                      <ul style={{listStyle:'none', padding:0, maxHeight:'400px', overflowY:'auto'}}>
                          {pendingRequests.map(req => (
                              <li key={req.id} style={{borderLeft: req.type === 'WORK_PREFERENCE' ? '4px solid #2563eb' : '4px solid #f59e0b', padding:'12px', marginBottom:'10px', borderRadius:'6px', background:'#f8fafc', boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}>
                                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                                      <strong style={{fontSize:'1rem'}}>{req.user.name}</strong>
                                      <span style={{fontSize:'0.75rem', fontWeight:'bold', textTransform:'uppercase', color: req.type === 'WORK_PREFERENCE' ? '#2563eb' : '#d97706', background:'white', padding:'2px 6px', borderRadius:'4px', border: `1px solid ${req.type === 'WORK_PREFERENCE' ? '#2563eb' : '#d97706'}`}}>
                                          {req.type === 'WORK_PREFERENCE' ? 'PRACA' : 'NIEOBECNOŚĆ'}
                                      </span>
                                  </div>
                                  <div style={{color:'#475569', fontSize:'0.9rem'}}>📅 {format(parseISO(req.startDate), 'dd.MM')} — {format(parseISO(req.endDate), 'dd.MM')}</div>
                                  {req.reason && <div style={{marginTop:'5px', fontStyle:'italic', fontSize:'0.85rem', color:'#64748b', background:'#fff', padding:'4px 8px', borderRadius:'4px', border:'1px solid #e2e8f0'}}>"{req.reason}"</div>}
                                  <div style={{marginTop:'12px', display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                                      <button onClick={() => handleResolveRequest(req.id, 'APPROVED')} style={{...styles.btnPub, padding:'6px 12px', fontSize:'0.8rem'}}>Tak</button>
                                      <button onClick={() => handleResolveRequest(req.id, 'REJECTED')} style={{...styles.btnSettings, padding:'6px 12px', background:'#ef4444', color:'white', border:'none', fontSize:'0.8rem'}}>Nie</button>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  )}
                  <button onClick={() => setShowRequestsList(false)} style={{marginTop:'20px', width:'100%', padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'6px', fontWeight:'bold', color:'#64748b', cursor:'pointer'}}>Zamknij</button>
              </div>
          </div>
      )}

      {/* HEADER + TOOLTIPS */}
      <div style={styles.header}>
        <div style={{display:'flex', flexDirection:'column', width: '100%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', width: '100%'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} style={styles.navBtn}>◀</button>
                    <div style={{textAlign:'center', minWidth:'150px'}}>
                        <h2 style={{margin:0, fontSize:'1.4rem', textTransform:'capitalize'}}>{format(currentDate, 'MMMM yyyy', { locale: pl })}</h2>
                    </div>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} style={styles.navBtn}>▶</button>
                </div>

                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    {!isSelectionMode && (
                        <TooltipWrapper text="Uruchom tryb malowania grafiku (Drag & Drop)">
                            <button onClick={() => setIsSelectionMode(true)} style={{...styles.btnSettings, background:'white', color:'#2563eb', border:'2px solid #2563eb', display:'flex', alignItems:'center', gap:'5px'}}>
                                ✏️ Planuj / Zgłoś
                            </button>
                        </TooltipWrapper>
                    )}

                    {isManager && (
                        <>
                            <div style={{width:'1px', background:'#e2e8f0', height:'30px', margin:'0 5px'}}></div>
                            <TooltipWrapper text="Oczekujące wnioski pracowników">
                                <button onClick={() => setShowRequestsList(true)} style={{...styles.btnSettings, position:'relative'}}>
                                    📬 {pendingRequests.length > 0 && <span style={styles.badge}>{pendingRequests.length}</span>}
                                </button>
                            </TooltipWrapper>
                            <TooltipWrapper text="Ustawienia grafiku (limity, reguły)">
                                <button onClick={() => setShowSettings(true)} style={styles.btnSettings}>⚙️</button>
                            </TooltipWrapper>
                            <TooltipWrapper text="Automatycznie wygeneruj grafik z szablonów">
                                <button onClick={handleGenerate} style={styles.btnGen}>⚡</button>
                            </TooltipWrapper>
                            <TooltipWrapper text="Opublikuj grafik (udostępnij pracownikom)">
                                <button onClick={handlePublish} style={styles.btnPub}>📢</button>
                            </TooltipWrapper>
                        </>
                    )}
                </div>
            </div>

            {/* --- PASKI ZAKŁADEK (MIASTA) --- */}
            {!myClinicId && clinicsList.length > 1 && (
                <div style={{display: 'flex', gap: '10px', marginTop: '15px', borderTop: '2px solid #f1f5f9', paddingTop: '10px'}}>
                    <button 
                        onClick={() => setSelectedClinic('ALL')}
                        style={{
                            padding: '8px 16px', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
                            border: 'none', borderBottom: selectedClinic === 'ALL' ? '3px solid #2563eb' : '3px solid transparent',
                            color: selectedClinic === 'ALL' ? '#2563eb' : '#64748b'
                        }}>
                        Wszystkie Placówki
                    </button>
                    {clinicsList.map(c => (
                        <button 
                            key={c.id}
                            onClick={() => setSelectedClinic(c.name)}
                            style={{
                                padding: '8px 16px', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
                                border: 'none', borderBottom: selectedClinic === c.name ? '3px solid #2563eb' : '3px solid transparent',
                                color: selectedClinic === c.name ? '#2563eb' : '#64748b'
                            }}>
                            📍 {c.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* SELECTION BAR (MALOWANIE) */}
      {isSelectionMode && (
          <div style={styles.selectionBar}>
              <div style={{marginRight:'20px'}}>
                  <span style={{color:'#64748b', fontSize:'0.9rem', marginRight:'5px'}}>Wybrano:</span>
                  <strong style={{fontSize:'1.2rem'}}>{selectedDates.size}</strong>
              </div>
              
              {isManager && (
                  <div style={{marginRight:'10px', display:'flex', flexDirection:'column'}}>
                      <label style={{fontSize:'0.65rem', fontWeight:'bold', color:'#64748b', textTransform:'uppercase'}}>Edytujesz:</label>
                      <select style={{padding:'6px', borderRadius:'4px', border:'1px solid #cbd5e1', fontWeight:'bold'}} value={paintTargetId || ''} onChange={(e) => setPaintTargetId(e.target.value ? Number(e.target.value) : null)}>
                          <option value="">📝 Siebie (Wniosek)</option>
                          <optgroup label="Grafik Pracownika">
                            {staffList.filter(s => s.id !== userId).map(s => (<option key={s.id} value={s.id}>👤 {s.name}</option>))}
                          </optgroup>
                      </select>
                  </div>
              )}

              <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={() => openBulkModal('WORK')} disabled={!canRequestWork() && !isManager} style={{...styles.btnGen, background:'#2563eb'}}>
                      {isManager && paintTargetId ? 'Wstaw Pracę' : '🙋 Zgłoś Dyspozycyjność'}
                  </button>
                  <button onClick={() => openBulkModal('ABSENCE')} style={{...styles.btnGen, background:'#f59e0b'}}>
                      {isManager && paintTargetId ? 'Wstaw Urlop / L4' : '🏥 Zgłoś Urlop / L4'}
                  </button>
                  <button onClick={() => { setIsSelectionMode(false); setSelectedDates(new Set()); setPaintTargetId(null); }} style={{...styles.btnSettings, background:'#ef4444', color:'white', width:'40px'}}>X</button>
              </div>
          </div>
      )}

      {/* MAIN GRID */}
      <div style={{...styles.grid, opacity: loading ? 0.5 : 1}} onMouseLeave={() => setDragMode(null)}>
        {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'].map(d => <div key={d} style={styles.dayHeader}>{d}</div>)}
        {emptyDays.map((_, i) => <div key={`empty-${i}`} style={styles.dayCellEmpty} />)}

        {daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            // ZMIANA: Renderujemy tylko odfiltrowane zmiany (displayedShifts)
            const dayShifts = displayedShifts.filter(s => isSameDay(parseISO(s.date), day));
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDates.has(dateStr);

            const handleCellClick = () => { 
                if (isSelectionMode) {
                    if(selectedDates.has(dateStr)) updateSelection(dateStr, 'deselect');
                    else updateSelection(dateStr, 'select');
                }
                else if (isManager) setShowDayDetails(day); 
            };
            
            const onMouseDown = () => handleMouseDown(dateStr);
            const onMouseEnter = () => handleMouseEnter(dateStr);

            let cellStyle = {...styles.dayCell, borderColor: isToday ? '#2563eb' : '#e2e8f0'};
            if (isSelected) cellStyle = {...cellStyle, background: '#eff6ff', borderColor: '#2563eb', border:'2px solid #2563eb'};
            if (isSelectionMode) cellStyle.cursor = 'cell';
            else if (isManager) cellStyle.cursor = 'pointer';

            return (
                <div key={day.toString()} style={cellStyle} onClick={handleCellClick} onMouseDown={onMouseDown} onMouseEnter={onMouseEnter}>
                    <div style={{...styles.dayNum, color: isToday ? '#2563eb' : '#64748b'}}>{format(day, 'd')}</div>
                    <div style={styles.shiftsList}>
                        {dayShifts.map(shift => {
                            let bg = '#dcfce7'; let color = '#166534'; let border = '1px solid #bbf7d0';
                            let icon = '';

                            if (shift.note === 'VACATION') { bg = '#fef9c3'; color = '#854d0e'; border = '1px solid #fde047'; icon = '🏖️'; }
                            else if (shift.note === 'SICK_LEAVE') { bg = '#f3e8ff'; color = '#6b21a8'; border = '1px solid #d8b4fe'; icon = '🚑'; }
                            else if (shift.note === 'Z prośby pracownika') { bg = '#dbeafe'; color = '#1e40af'; border = '1px solid #93c5fd'; icon = '🙋'; }
                            else if (shift.status === 'DRAFT') { bg = '#f1f5f9'; color = '#64748b'; border = '1px dashed #cbd5e1'; icon = '✏️'; }

                            return (
                                <div key={shift.id} 
                                     onClick={(e) => { 
                                         if(!isSelectionMode && isManager) {
                                            e.stopPropagation(); 
                                            setShowDayDetails(day); 
                                         }
                                     }}
                                     style={{...styles.shiftBadge, background: bg, color, border}}>
                                    
                                    {['VACATION', 'SICK_LEAVE', 'ON_DEMAND'].includes(shift.note || '') ? (
                                        <strong>{icon} {shift.user.name.split(' ')[0]}</strong>
                                    ) : (
                                        <div style={{display:'flex', justifyContent:'space-between'}}>
                                            <span style={{fontWeight:'bold'}}>{shift.user.name.split(' ')[0]}</span>
                                            <span style={{fontSize:'0.7rem', opacity:0.9}}>{getRawTime(shift.startTime)}-{getRawTime(shift.endTime)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 11. STYLE CSS
// =============================================================================

const styles: any = {
  header: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '10px', 
      background: 'white', 
      padding: '10px 15px', 
      borderRadius: '12px', 
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)' 
  },
  selectionBar: { 
      position:'fixed', 
      bottom:'30px', 
      left:'50%', 
      transform:'translateX(-50%)', 
      background:'white', 
      padding:'10px 20px', 
      borderRadius:'16px', 
      boxShadow:'0 10px 40px rgba(0,0,0,0.3)', 
      display:'flex', 
      alignItems:'center', 
      gap:'15px', 
      zIndex: 1000, 
      border:'2px solid #2563eb' 
  },
  navBtn: { 
      background: 'none', 
      border: '1px solid #ddd', 
      borderRadius: '4px', 
      cursor: 'pointer', 
      fontSize: '1.2rem', 
      padding: '2px 8px' 
  },
  btnGen: { 
      padding: '8px 12px', 
      background: '#2563eb', 
      color: 'white', 
      border: 'none', 
      borderRadius: '6px', 
      fontWeight: 'bold', 
      cursor: 'pointer' 
  },
  btnPub: { 
      padding: '8px 12px', 
      background: '#10b981', 
      color: 'white', 
      border: 'none', 
      borderRadius: '6px', 
      fontWeight: 'bold', 
      cursor: 'pointer' 
  },
  btnSettings: { 
      padding: '8px 12px', 
      background: '#64748b', 
      color: 'white', 
      border: 'none', 
      borderRadius: '6px', 
      fontWeight: 'bold', 
      cursor: 'pointer' 
  },
  input: { 
      padding: '8px', 
      border: '1px solid #cbd5e1', 
      borderRadius: '4px', 
      width: '100%', 
      boxSizing:'border-box' 
  },
  badge: { 
      position:'absolute', 
      top:'-8px', 
      right:'-8px', 
      background:'#ef4444', 
      color:'white', 
      borderRadius:'50%', 
      width:'18px', 
      height:'18px', 
      fontSize:'0.7rem', 
      display:'flex', 
      alignItems:'center', 
      justifyContent:'center', 
      border:'2px solid white' 
  },
  grid: { 
      display: 'grid', 
      gridTemplateColumns: 'repeat(7, 1fr)', 
      gap: '8px', 
      userSelect: 'none' 
  }, 
  dayHeader: { 
      textAlign: 'center', 
      fontWeight: 'bold', 
      color: '#64748b', 
      padding: '5px', 
      textTransform: 'uppercase', 
      fontSize: '0.75rem' 
  },
  dayCellEmpty: { 
      background: 'transparent' 
  },
  dayCell: { 
      background: 'white', 
      height: '130px', 
      borderRadius: '6px', 
      border: '1px solid #e2e8f0', 
      padding: '4px', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden' 
  },
  dayNum: { 
      fontWeight: 'bold', 
      marginBottom: '2px', 
      fontSize: '0.8rem', 
      paddingLeft:'2px' 
  },
  shiftsList: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px', 
      flex: 1, 
      overflowY: 'auto', 
      paddingRight: '2px', 
      scrollbarWidth: 'thin' 
  },
  shiftBadge: { 
      padding: '3px 6px', 
      borderRadius: '3px', 
      fontSize: '0.75rem', 
      lineHeight: '1.2', 
      cursor:'pointer' 
  },
  
  // NOWE STYLE DLA TOOLTIPA (Ciemny, elegancki)
  tooltip: {
      position: 'absolute',
      bottom: '125%', 
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#1e293b',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: '6px',
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
      zIndex: 1000,
      pointerEvents: 'none',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      fontWeight: '500',
      opacity: 0.95
  },
  tooltipArrow: {
      position: 'absolute',
      top: '100%',
      left: '50%',
      marginLeft: '-5px',
      borderWidth: '5px',
      borderStyle: 'solid',
      borderColor: '#1e293b transparent transparent transparent'
  }
};