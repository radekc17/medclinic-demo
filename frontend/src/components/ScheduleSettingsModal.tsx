import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Room {
  id: number;
  name: string;
  type: string;
}

interface DoctorUser {
  id: number; 
  userId: number; 
  user: { name: string };
}

interface Template {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: { name: string };
}

interface Props {
  onClose: () => void;
}

const DAYS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

export function ScheduleSettingsModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'templates'>('rooms');
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('Konsultacyjny');

  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null); 
  const [templates, setTemplates] = useState<Template[]>([]);
  
  const [newTplDay, setNewTplDay] = useState(1);
  const [newTplStart, setNewTplStart] = useState('08:00');
  const [newTplEnd, setNewTplEnd] = useState('16:00');
  const [newTplRoom, setNewTplRoom] = useState<number | ''>('');

  useEffect(() => {
      fetchRooms();
      fetchDoctors();
  }, []);

  useEffect(() => {
      if (selectedDoctorId) {
          fetchTemplates(selectedDoctorId);
      } else {
          setTemplates([]);
      }
  }, [selectedDoctorId]);

  const fetchRooms = async () => {
      try {
          const res = await fetch('http://localhost:3000/rooms', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) setRooms(await res.json());
      } catch(e) { console.error(e); }
  };

  const fetchDoctors = async () => {
    try {
        const res = await fetch('http://localhost:3000/doctors');
        if (res.ok) setDoctors(await res.json());
    } catch(e) { console.error(e); }
  };

  const fetchTemplates = async (userId: number) => {
    try {
        const res = await fetch(`http://localhost:3000/schedule-templates/user/${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setTemplates(await res.json());
    } catch(e) { console.error(e); }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const res = await fetch('http://localhost:3000/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({ name: newRoomName, type: newRoomType, clinicId: 1 }) 
          });
          if (res.ok) {
              toast.success('Dodano gabinet');
              setNewRoomName('');
              fetchRooms();
          }
      } catch(e) { toast.error('Błąd'); }
  };

  const handleDeleteRoom = async (id: number) => {
      if(!window.confirm('Usunąć ten gabinet?')) return;
      try {
          const res = await fetch(`http://localhost:3000/rooms/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.ok) { toast.success('Usunięto'); fetchRooms(); }
      } catch(e) { toast.error('Błąd'); }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDoctorId) return toast.error('Wybierz lekarza');
      try {
          const res = await fetch('http://localhost:3000/schedule-templates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({
                  userId: selectedDoctorId,
                  dayOfWeek: newTplDay,
                  startTime: newTplStart,
                  endTime: newTplEnd,
                  roomId: newTplRoom ? Number(newTplRoom) : undefined,
                  validFrom: new Date().toISOString()
              })
          });
          if (res.ok) {
              toast.success('Szablon dodany');
              fetchTemplates(selectedDoctorId);
          }
      } catch(e) { toast.error('Błąd'); }
  };

  const handleDeleteTemplate = async (id: number) => {
    if(!window.confirm('Usunąć ten szablon?')) return;
    try {
        const res = await fetch(`http://localhost:3000/schedule-templates/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok && selectedDoctorId) { 
            toast.success('Usunięto'); 
            fetchTemplates(selectedDoctorId); 
        }
    } catch(e) { toast.error('Błąd'); }
};

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: '1.8rem', letterSpacing: '-1px' }}>⚙️ Konfiguracja systemowa</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b', lineHeight: 0.5 }}>&times;</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            <button onClick={() => setActiveTab('rooms')} style={{...styles.tab, borderBottom: activeTab === 'rooms' ? '3px solid #2563eb' : '3px solid transparent', color: activeTab === 'rooms' ? '#2563eb' : '#64748b'}}>🏢 Gabinety / Sale</button>
            <button onClick={() => setActiveTab('templates')} style={{...styles.tab, borderBottom: activeTab === 'templates' ? '3px solid #2563eb' : '3px solid transparent', color: activeTab === 'templates' ? '#2563eb' : '#64748b'}}>📅 Szablony Lekarzy</button>
        </div>

        {activeTab === 'rooms' && (
            <div>
                <form onSubmit={handleAddRoom} style={{ display: 'flex', gap: '15px', marginBottom: '30px', alignItems: 'end', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{flex: 2}}>
                        <label style={styles.label}>Nazwa gabinetu</label>
                        <input value={newRoomName} onChange={e=>setNewRoomName(e.target.value)} placeholder="np. Gabinet 101" required style={styles.input} />
                    </div>
                    <div style={{flex: 1}}>
                        <label style={styles.label}>Typ</label>
                        <select value={newRoomType} onChange={e=>setNewRoomType(e.target.value)} style={styles.input}>
                            <option>Konsultacyjny</option>
                            <option>Zabiegowy</option>
                            <option>Specjalistyczny</option>
                        </select>
                    </div>
                    <button type="submit" style={styles.btnAction}>+ Dodaj</button>
                </form>

                <h3 style={{color: '#0f172a', fontSize: '1.2rem', fontWeight: 800}}>Lista aktywnych gabinetów</h3>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {rooms.map(r => (
                        <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', alignItems: 'center' }}>
                            <div>
                                <strong style={{color: '#0f172a', fontSize: '1.1rem'}}>{r.name}</strong> 
                                <span style={{marginLeft: '10px', fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 8px', borderRadius: '20px', color: '#475569', fontWeight: 700}}>{r.type}</span>
                            </div>
                            <button onClick={() => handleDeleteRoom(r.id)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold'}}>Usuń ✖</button>
                        </li>
                    ))}
                    {rooms.length === 0 && <p style={{color: '#94a3b8'}}>Brak zdefiniowanych gabinetów.</p>}
                </ul>
            </div>
        )}

        {activeTab === 'templates' && (
            <div>
                <div style={{ marginBottom: '25px' }}>
                    <label style={styles.label}>Wybierz lekarza z personelu:</label>
                    <select value={selectedDoctorId || ''} onChange={e => setSelectedDoctorId(Number(e.target.value))} style={{...styles.input, background: '#f8fafc', fontWeight: 'bold'}}>
                        <option value="">-- Wybierz --</option>
                        {doctors.map(d => (
                            <option key={d.userId} value={d.userId}>{d.user.name}</option>
                        ))}
                    </select>
                </div>

                {selectedDoctorId ? (
                    <>
                        <form onSubmit={handleAddTemplate} style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', alignItems: 'end', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{flex: 1, minWidth: '120px'}}>
                                <label style={styles.label}>Dzień tyg.</label>
                                <select value={newTplDay} onChange={e=>setNewTplDay(Number(e.target.value))} style={styles.input}>
                                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                            </div>
                            <div style={{width: '90px'}}>
                                <label style={styles.label}>Start</label>
                                <input type="time" value={newTplStart} onChange={e=>setNewTplStart(e.target.value)} required style={styles.input} />
                            </div>
                            <div style={{width: '90px'}}>
                                <label style={styles.label}>Koniec</label>
                                <input type="time" value={newTplEnd} onChange={e=>setNewTplEnd(e.target.value)} required style={styles.input} />
                            </div>
                            <div style={{flex: 1.5, minWidth: '150px'}}>
                                <label style={styles.label}>Gabinet (Opcjonalnie)</label>
                                {/* FIX TS: Rzutowanie do numeru w select onChange */}
                                <select value={newTplRoom} onChange={e=>setNewTplRoom(e.target.value ? Number(e.target.value) : '')} style={styles.input}>
                                    <option value="">- Brak -</option>
                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <button type="submit" style={{...styles.btnAction, width: '100%', marginTop: '10px'}}>+ Dodaj Szablon</button>
                        </form>

                        <div>
                            <h3 style={{color: '#0f172a', fontSize: '1.2rem', fontWeight: 800}}>Stałe szablony pracy</h3>
                            {templates.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {templates.map(t => (
                                        <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', alignItems: 'center' }}>
                                            <span style={{fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '15px'}}>
                                                <button onClick={() => handleDeleteTemplate(t.id)} style={{background: '#fee2e2', border: 'none', color: '#dc2626', cursor: 'pointer', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>✖</button>
                                                <span style={{width: '100px'}}>{DAYS[t.dayOfWeek]}</span> 
                                                <span style={{color: '#2563eb'}}>🕗 {t.startTime} - {t.endTime}</span>
                                            </span>
                                            {t.room && <span style={{background:'#dcfce7', color:'#166534', padding:'4px 10px', borderRadius:'6px', fontSize:'0.8rem', fontWeight: 'bold'}}>📍 {t.room.name}</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : <p style={{color:'#94a3b8', fontStyle: 'italic'}}>Brak zdefiniowanych szablonów dla tego lekarza.</p>}
                        </div>
                    </>
                ) : (
                    <div style={{textAlign:'center', padding:'40px', color:'#94a3b8', border:'2px dashed #cbd5e1', borderRadius:'12px', background: '#f8fafc', fontWeight: 600}}>
                        👈 Wybierz lekarza z listy powyżej, aby zarządzać jego szablonami.
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
}

const styles: any = {
    tab: { background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase' },
    label: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase' },
    input: { padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', outline: 'none' },
    btnAction: { background: '#2563eb', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }
};