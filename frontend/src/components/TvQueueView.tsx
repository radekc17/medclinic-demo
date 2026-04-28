import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

interface AppointmentUpdate {
  id: number;
  status: string;
  guestName?: string;
  doctorId: number;
  patient?: { name: string };
  doctor?: { room?: string };
}

export function TvQueueView() {
  const [activeCalls, setActiveCalls] = useState<Record<string, AppointmentUpdate>>({});
  const [history, setHistory] = useState<AppointmentUpdate[]>([]);
  
  const [setupMode, setSetupMode] = useState(true);
  const [clinics, setClinics] = useState<any[]>([]);
  const [clinicName, setClinicName] = useState('MED-CLINIC');
  const validDoctorIds = useRef<number[]>([]); 

  const retryCounters = useRef<Record<number, number>>({});
  const lastAnnounced = useRef<Record<number, number>>({});
  const activeCallsRef = useRef<Record<string, AppointmentUpdate>>({});

  useEffect(() => { activeCallsRef.current = activeCalls; }, [activeCalls]);

  useEffect(() => {
    fetch('http://localhost:3000/clinics')
      .then(res => res.json())
      .then(data => setClinics(data))
      .catch(err => console.error("Błąd pobierania klinik dla TV:", err));

    const savedClinicId = localStorage.getItem('tvClinicId');
    if (savedClinicId) loadClinicData(Number(savedClinicId));
  }, []);

  const loadClinicData = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/clinics/${id}`);
      const data = await res.json();
      setClinicName(data.name);
      validDoctorIds.current = data.doctors.map((d: any) => d.id); 
      localStorage.setItem('tvClinicId', id.toString());
      setSetupMode(false); 
    } catch (e) { console.error("Błąd wczytywania", e); }
  };

  const resetTv = () => {
    localStorage.removeItem('tvClinicId');
    setSetupMode(true);
    setActiveCalls({});
    setHistory([]);
  };

  const getTicketString = (id: number) => `W-${id.toString().padStart(3, '0')}`;
  
  // --- KONWERTER LICZB NA SŁOWA (ŻEBY NIE BYŁO "PIERWSZEGO") ---
  const numberToPolishWords = (n: number): string => {
    const units = ["", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć"];
    const teens = ["dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
    const tens = ["", "dziesięć", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];
    const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];

    if (n === 0) return "zero";
    let tempN = n;
    let res = "";
    if (tempN >= 100) { res += hundreds[Math.floor(tempN / 100)] + " "; tempN %= 100; }
    if (tempN >= 20) { res += tens[Math.floor(tempN / 10)] + " "; tempN %= 10; }
    else if (tempN >= 10) { res += teens[tempN - 10] + " "; tempN = 0; }
    if (tempN > 0) { res += units[tempN]; }
    return res.trim();
  };

  const getSpokenTicket = (id: number) => {
    if (id < 10) return `Wu, zero, zero, ${numberToPolishWords(id)}`;
    if (id < 100) return `Wu, zero, ${numberToPolishWords(id)}`;
    return `Wu, ${numberToPolishWords(id)}`;
  };

  const getSpokenRoom = (room: string) => {
    const roomNumberMatch = room.match(/\d+/);
    const roomNumber = roomNumberMatch ? parseInt(roomNumberMatch[0]) : null;

    if (roomNumber !== null) {
        // Wymuszamy tekst "gabinetu numer [słownie sto jeden]"
        return `gabinetu numer ${numberToPolishWords(roomNumber)}`;
    }
    return room.replace(/\(.*\)/g, '').replace(/gabinet/gi, 'gabinetu').trim();
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.rate = 0.8; // Wolniej = wyraźniej
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const plVoices = voices.filter(v => v.lang.includes('PL'));
    
    const bestVoice = plVoices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Paulina') || 
      v.name.includes('Agata')
    ) || plVoices[0]; 

    if (bestVoice) utterance.voice = bestVoice;
    window.speechSynthesis.speak(utterance);
  };

  const announcePatient = (id: number, room: string) => {
    const spokenTicket = getSpokenTicket(id);
    const spokenRoom = getSpokenRoom(room);
    
    // Kropka po numerku wymusza twardą pauzę, co naprawia "douu" i odmianę "sto jeden"
    const text = `Numer ${spokenTicket}. Proszony do ${spokenRoom}.`;

    const audio = new Audio('/bell.mp3');
    audio.play()
      .then(() => setTimeout(() => speak(text), 2200))
      .catch(() => speak(text));
  };

  const markAsAbsent = async (appId: number) => {
    try {
      await fetch(`http://localhost:3000/appointments/${appId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ABSENT' })
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (setupMode) return; 

    const socket = io('http://localhost:3000', { transports: ['websocket'] });
    socket.on('connect', () => socket.emit('join-room', 'tv-global'));

    socket.on('appointment_updated', (data: AppointmentUpdate) => {
      if (!validDoctorIds.current.includes(data.doctorId)) return;

      const roomKey = data.doctor?.room || `G${data.doctorId}`;

      if (data.status === 'CALLED') {
        const roomName = data.doctor?.room || data.doctorId.toString();
        setActiveCalls(prev => ({ ...prev, [roomKey]: data }));
        retryCounters.current[data.id] = 1;
        lastAnnounced.current[data.id] = Date.now();

        announcePatient(data.id, roomName);

        setHistory(prev => {
          if (prev.find(h => h.id === data.id)) return prev;
          return [data, ...prev].slice(0, 5);
        });
      } 
      else if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABSENT'].includes(data.status)) {
        setActiveCalls(prev => {
          const newCalls = { ...prev };
          delete newCalls[roomKey];
          return newCalls;
        });
        delete retryCounters.current[data.id];
        delete lastAnnounced.current[data.id];
      }
    });

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const currentCalls = Object.values(activeCallsRef.current);

      currentCalls.forEach(call => {
        const timeSinceLast = now - (lastAnnounced.current[call.id] || 0);
        if (timeSinceLast > 90000) { 
          const currentRetries = retryCounters.current[call.id] || 0;
          if (currentRetries < 5) {
            retryCounters.current[call.id] = currentRetries + 1;
            lastAnnounced.current[call.id] = now;
            announcePatient(call.id, call.doctor?.room || call.doctorId.toString());
          } else {
            markAsAbsent(call.id);
          }
        }
      });
    }, 15000);

    return () => { socket.disconnect(); clearInterval(checkInterval); };
  }, [setupMode]);

  const activeRooms = Object.keys(activeCalls);

  const tvAnimations = `
    @keyframes pulseCard {
      0% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.2); border-color: rgba(37, 99, 235, 0.3); }
      50% { box-shadow: 0 0 60px rgba(37, 99, 235, 0.6); border-color: rgba(37, 99, 235, 1); }
      100% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.2); border-color: rgba(37, 99, 235, 0.3); }
    }
    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .call-card-anim {
      animation: slideInUp 0.6s ease-out forwards, pulseCard 3s infinite ease-in-out;
    }
  `;

  if (setupMode) {
    return (
      <div style={styles.fullscreen}>
        <div style={{margin: 'auto', textAlign: 'center', background: '#0f172a', padding: '60px', borderRadius: '30px', border: '1px solid #1e293b'}}>
          <h2 style={{fontSize: '3rem', marginBottom: '20px', color: '#f8fafc', fontWeight: 900}}>Konfiguracja Ekranu TV</h2>
          <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
            {clinics.map(c => (
              <button key={c.id} onClick={() => loadClinicData(c.id)} style={styles.setupBtn}>📍 {c.name}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.fullscreen}>
      <style>{tvAnimations}</style>
      
      <header style={styles.header}>
        <div style={styles.logoArea}>
          <h1 style={styles.mainTitle}>{clinicName}</h1>
          <span style={styles.subTitle}>KOMUNIKATY KOLEJKOWE</span>
        </div>
        <div style={styles.clock}>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </header>

      <main style={styles.mainArea}>
        {activeRooms.length === 0 ? (
          <div style={styles.idleMessage}>
            <h2 style={{fontSize: '5vw', fontWeight: '900', color: '#1e293b'}}>ZAPRASZAMY</h2>
            <p style={{fontSize: '2vw', color: '#475569'}}>Proszę oczekiwać na wywołanie numerku</p>
          </div>
        ) : (
          <div style={{...styles.grid, gridTemplateColumns: activeRooms.length > 1 ? '1fr 1fr' : '1fr'}}>
            {Object.values(activeCalls).map((call) => (
              <div key={call.id} className="call-card-anim" style={styles.callCard}>
                <div style={styles.cardLabel}>NUMER:</div>
                <div style={styles.cardPatient}>{getTicketString(call.id)}</div>
                <div style={styles.divider} />
                <div style={styles.cardRoomLabel}>GABINET:</div>
                <div style={styles.cardRoom}>{call.doctor?.room || `GABINET ${call.doctorId}`}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <div style={styles.historyContainer}>
          <div style={styles.historyTitle}>OSTATNIO WYWOŁANE:</div>
          <div style={styles.historyRow}>
            {history.map((h, i) => (
              <div key={i} style={styles.historyItem}>
                <span style={styles.histName}>{getTicketString(h.id)}</span>
                <span style={styles.histRoom}>→ {h.doctor?.room || h.doctorId}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={resetTv} style={styles.resetBtn}>Resetuj Ekran</button>
      </footer>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  fullscreen: { height: '100vh', width: '100vw', background: '#000000', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
  header: { height: '15vh', background: '#020617', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5vw', borderBottom: '2px solid #1e293b' },
  mainTitle: { fontSize: '3vw', fontWeight: '900', margin: 0, color: '#f8fafc' },
  subTitle: { fontSize: '1.2vw', color: '#64748b', letterSpacing: '4px' },
  clock: { fontSize: '4vw', fontWeight: '900', color: '#3b82f6' },
  mainArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vw' },
  grid: { display: 'grid', gap: '4vw', width: '100%', height: '100%' },
  callCard: { background: '#0f172a', borderRadius: '4vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4vw', border: '3px solid #1e293b' },
  cardLabel: { fontSize: '2vw', color: '#94a3b8', fontWeight: 'bold' },
  cardPatient: { fontSize: '12vw', fontWeight: '900', color: '#facc15', lineHeight: 1, margin: '1vh 0' },
  divider: { width: '40%', height: '4px', background: '#1e293b', margin: '3vh 0', borderRadius: '2px' },
  cardRoomLabel: { fontSize: '2vw', color: '#94a3b8', fontWeight: 'bold' },
  cardRoom: { fontSize: '5vw', fontWeight: '900', color: '#f8fafc' },
  idleMessage: { textAlign: 'center', background: '#f8fafc', padding: '6vw', borderRadius: '4vw', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
  footer: { height: '20vh', background: '#020617', padding: '0 5vw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1e293b' },
  historyContainer: { flex: 1 },
  historyTitle: { fontSize: '1.2vw', color: '#3b82f6', fontWeight: '900', marginBottom: '2vh' },
  historyRow: { display: 'flex', gap: '2vw' },
  historyItem: { background: '#0f172a', padding: '1.5vh 2vw', borderRadius: '1.5vw', display: 'flex', gap: '1.5vw', alignItems: 'center', border: '1px solid #1e293b' },
  histName: { fontSize: '2vw', fontWeight: '900', color: '#facc15' },
  histRoom: { fontSize: '1.5vw', color: '#94a3b8' },
  resetBtn: { background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: '1vw' },
  setupBtn: { padding: '25px', fontSize: '2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }
};