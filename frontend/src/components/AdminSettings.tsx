import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface AdminSettingsProps {
  onRefreshData?: () => void;
}

export function AdminSettings({ onRefreshData }: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'staff'>('system'); // Domyślnie Ustawienia Systemowe
  const [loading, setLoading] = useState(true);

  // --- STANY SYSTEMOWE (WSZYSTKIE TWOJE ORYGINALNE POLA) ---
  const [settings, setSettings] = useState({
    longTermSmsHours: 48, 
    shortTermSmsHours: 2, 
    lastMinuteLimitHours: 2, 
    isTvModuleActive: false, 
    skipManualVerification: false
  });

  // --- STANY PERSONELU ---
  const [staff, setStaff] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST', clinicId: '' });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [settingsRes, staffRes, clinicsRes] = await Promise.all([
        fetch('https://medclinic-demo.onrender.com/settings', { headers }),
        fetch('https://medclinic-demo.onrender.com/staff', { headers }),
        fetch('https://medclinic-demo.onrender.com/clinics')
      ]);

      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
      if (clinicsRes.ok) setClinics(await clinicsRes.json());
    } catch (e) {
      toast.error("Błąd pobierania danych z serwera");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- AKCJE SYSTEMOWE ---
  const handleSaveSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('https://medclinic-demo.onrender.com/settings', {
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify(settings)
      });
      if (res.ok) toast.success("Zapisano ustawienia systemowe");
    } catch (e) { toast.error("Błąd zapisu"); }
  };

  // --- AKCJE PERSONELU ---
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('https://medclinic-demo.onrender.com/staff', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify(newStaff)
      });
      if (res.ok) {
        toast.success('Utworzono nowe konto pracownika!');
        setNewStaff({ name: '', email: '', password: '', role: 'RECEPTIONIST', clinicId: '' });
        fetchData();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Błąd tworzenia konta');
      }
    } catch (e) { toast.error("Błąd połączenia"); }
  };

  const handleUpdateStaff = async (id: number, field: string, value: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const finalValue = field === 'clinicId' 
        ? (value === "" ? null : Number(value)) 
        : value;

      const res = await fetch(`https://medclinic-demo.onrender.com/staff/${id}`, {
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ [field]: finalValue })
      });

      if (res.ok) {
        toast.success('Zaktualizowano pracownika!');
        fetchData(); 
        if (onRefreshData) onRefreshData(); 
      }
    } catch (e) { 
      toast.error("Błąd aktualizacji"); 
    }
  };

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>Ładowanie panelu administracyjnego...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{color: '#1e293b', marginBottom: '20px'}}>Panel Administratora</h2>
      
      {/* TABS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
        <button onClick={() => setActiveTab('system')} style={{...styles.tabBtn, borderBottom: activeTab === 'system' ? '3px solid #2563eb' : '3px solid transparent', color: activeTab === 'system' ? '#2563eb' : '#64748b'}}>⚙️ Ustawienia Systemowe</button>
        <button onClick={() => setActiveTab('staff')} style={{...styles.tabBtn, borderBottom: activeTab === 'staff' ? '3px solid #2563eb' : '3px solid transparent', color: activeTab === 'staff' ? '#2563eb' : '#64748b'}}>👥 Zarządzanie Personelem</button>
      </div>

      {/* ZAKŁADKA: USTAWIENIA SYSTEMOWE */}
      {activeTab === 'system' && (
        <div style={styles.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={styles.inputGroup}>
              <div style={styles.info}>
                <span style={styles.label}>Moduł Ekranu TV (Poczekalnia)</span>
                <span style={styles.small}>Włącza bramkę WebSockets dla telewizora</span>
              </div>
              <input type="checkbox" checked={settings.isTvModuleActive} onChange={e => setSettings({ ...settings, isTvModuleActive: e.target.checked })} style={{ width: '24px', height: '24px', cursor: 'pointer' }} />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.info}>
                <span style={styles.label}>Pomiń ręczną weryfikację wizyt (Admin Override)</span>
                <span style={styles.small}>Pozwala zignorować dzwonienie do pacjentów przy dużym ruchu na recepcji</span>
              </div>
              <input type="checkbox" checked={settings.skipManualVerification} onChange={e => setSettings({ ...settings, skipManualVerification: e.target.checked })} style={{ width: '24px', height: '24px', cursor: 'pointer' }} />
            </div>
            
            <div style={styles.inputGroup}>
              <div style={styles.info}>
                <span style={styles.label}>Godziny SMS długoterminowego</span>
                <span style={styles.small}>Ile godzin przed wizytą wysłać pierwsze przypomnienie (np. 48)</span>
              </div>
              <input type="number" value={settings.longTermSmsHours} onChange={e => setSettings({ ...settings, longTermSmsHours: parseInt(e.target.value) || 0 })} style={styles.inputSmall} />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.info}>
                <span style={styles.label}>Godziny SMS krótkoterminowego</span>
                <span style={styles.small}>Ile godzin przed wizytą wysłać drugie przypomnienie (np. 2)</span>
              </div>
              <input type="number" value={settings.shortTermSmsHours} onChange={e => setSettings({ ...settings, shortTermSmsHours: parseInt(e.target.value) || 0 })} style={styles.inputSmall} />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.info}>
                <span style={styles.label}>Limit "Last Minute" (godziny)</span>
                <span style={styles.small}>Blokada odwoływania wizyt przez pacjenta tuż przed terminem</span>
              </div>
              <input type="number" value={settings.lastMinuteLimitHours} onChange={e => setSettings({ ...settings, lastMinuteLimitHours: parseInt(e.target.value) || 0 })} style={styles.inputSmall} />
            </div>

            <button onClick={handleSaveSettings} style={{...styles.primaryBtn, marginTop: '20px'}}>Zapisz Konfigurację Systemu</button>
          </div>
        </div>
      )}

      {/* ZAKŁADKA: PERSONEL */}
      {activeTab === 'staff' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '30px'}}>
          
          <div style={styles.card}>
            <h3 style={{marginTop: 0, color: '#0f172a'}}>➕ Utwórz konto pracownika</h3>
            <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '20px'}}>Konto zostanie wyizolowane od bazy pacjentów. Przypisz odpowiednią rolę i placówkę.</p>
            
            <form onSubmit={handleCreateStaff} style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', alignItems: 'end'}}>
              <div><label style={styles.formLabel}>Imię i Nazwisko</label><input required value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} style={styles.input} /></div>
              <div><label style={styles.formLabel}>Email (Login)</label><input type="email" required value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} style={styles.input} /></div>
              <div><label style={styles.formLabel}>Tymczasowe Hasło</label><input type="password" required value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} style={styles.input} /></div>
              
              <div>
                <label style={styles.formLabel}>Rola systemowa</label>
                <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} style={styles.input}>
                  <option value="RECEPTIONIST">Recepcja / Rejestracja</option>
                  <option value="DOCTOR">Lekarz / Specjalista</option>
                  <option value="MANAGER">Manager / Kadry</option>
                  <option value="ADMIN">Główny Administrator</option>
                </select>
              </div>

              <div>
                <label style={styles.formLabel}>Przypisana Placówka</label>
                <select value={newStaff.clinicId} onChange={e => setNewStaff({...newStaff, clinicId: e.target.value})} style={styles.input}>
                  <option value="">🌍 Globalny (Wszystkie kliniki)</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <button type="submit" style={styles.primaryBtn}>Utwórz Konto</button>
            </form>
          </div>

          <div style={styles.card}>
            <h3 style={{marginTop: 0, color: '#0f172a'}}>📋 Aktywny Personel ({staff.length})</h3>
            <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '10px'}}>
              <thead>
                <tr style={{background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0'}}>
                  <th style={{padding: '12px', fontSize: '0.9rem', color: '#475569'}}>Imię / Email</th>
                  <th style={{padding: '12px', fontSize: '0.9rem', color: '#475569'}}>Rola w systemie</th>
                  <th style={{padding: '12px', fontSize: '0.9rem', color: '#475569'}}>Izolacja Placówki</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(user => (
                  <tr key={user.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={{padding: '12px'}}><strong>{user.name}</strong><br/><span style={{fontSize: '0.85rem', color: '#64748b'}}>{user.email}</span></td>
                    <td style={{padding: '12px'}}>
                      <select value={user.role} onChange={(e) => handleUpdateStaff(user.id, 'role', e.target.value)} style={{...styles.input, width: '160px'}}>
                        <option value="RECEPTIONIST">Recepcja</option>
                        <option value="DOCTOR">Lekarz</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td style={{padding: '12px'}}>
                      <select value={user.clinicId || ''} onChange={(e) => handleUpdateStaff(user.id, 'clinicId', e.target.value)} style={{...styles.input, width: '180px'}}>
                        <option value="">🌍 Globalny</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PANEL DIAGNOSTYCZNY DLA PREZENTACJI (Dodany na końcu) --- */}
      <div style={{ marginTop: '40px', padding: '25px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🛠️ Panel Diagnostyczny (Demo AI)
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
          Wymuś działanie automatyzacji bocznej bez czekania na harmonogram systemowy (Cron).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
          <button 
            onClick={async () => {
              try {
                const res = await fetch('https://medclinic-demo.onrender.com/system/debug/trigger-cron');
                if (res.ok) toast.success("🤖 Bot AI: Przetworzono wizyty (48h/24h)!");
              } catch (e) { toast.error("Błąd połączenia z robotem"); }
            }}
            style={{ padding: '15px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            🚀 Uruchom Robota
          </button>

          <button 
            onClick={async () => {
              try {
                const res = await fetch('https://medclinic-demo.onrender.com/system/debug/test-mail');
                if (res.ok) toast.success("📧 Wysłano maila startowego (Bez linku)!");
              } catch (e) { toast.error("Błąd bramki mailowej"); }
            }}
            style={{ padding: '15px', background: '#64748b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            📬 Test Maila (Zwykły)
          </button>

          <button 
            onClick={async () => {
              try {
                const res = await fetch('https://medclinic-demo.onrender.com/system/debug/test-mail-link');
                if (res.ok) toast.success("✅ Wysłano przypomnienie 48h (Z LINKIEM)!");
              } catch (e) { toast.error("Błąd bramki mailowej"); }
            }}
            style={{ padding: '15px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            🔗 Test Maila (Z Przyciskiem)
          </button>

          <div style={{ gridColumn: '1 / -1', padding: '15px', background: '#eff6ff', borderRadius: '10px', fontSize: '0.8rem', color: '#1e40af', border: '1px solid #bfdbfe', lineHeight: '1.5' }}>
            <strong>💡 Instrukcja Demo:</strong> Umów wizytę na poniedziałek. Użyj "Uruchom Robota", aby Halinka dostała alert w Radarze. Użyj przycisków "Test Maila", aby zaprezentować komisji różnicę w powiadomieniach e-mail na żywo.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  card: { background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  tabBtn: { background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: 'all 0.2s', outline: 'none' },
  inputGroup: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f1f5f9' },
  info: { flex: 1, paddingRight: '20px' },
  label: { display: 'block', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px', fontSize: '1rem' },
  small: { display: 'block', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' },
  formLabel: { display: 'block', fontWeight: 'bold', color: '#334155', marginBottom: '6px', fontSize: '0.85rem' },
  input: { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box', background: '#f8fafc', outline: 'none' },
  inputSmall: { width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', outline: 'none' },
  primaryBtn: { background: '#2563eb', color: 'white', border: 'none', padding: '14px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '1rem', transition: 'background 0.2s' }
};