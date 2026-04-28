import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { translations, type Language } from '../translations';

interface Props {
  user: any;
  lang: Language; 
  onUpdateUser: (user: any) => void;
}

export function UserProfile({ user, lang, onUpdateUser }: Props) {
  const t = translations[lang];

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', pesel: '', password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        pesel: user.pesel || '',
        password: ''
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    const payload: any = { ...formData };
    if (!payload.password) delete payload.password;

    try {
      const res = await fetch('http://localhost:3000/users/me', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updatedUser = await res.json();
        toast.success(t.success);
        onUpdateUser(updatedUser);
        setFormData({ ...formData, password: '' });
      } else {
        const err = await res.json();
        // FIX TS: t.error nie istnieje w translations
        toast.error(err.message || 'Wystąpił błąd zapisu danych');
      }
    } catch (error) {
      toast.error('Błąd połączenia');
    }
  };

  return (
    <div style={{maxWidth: '800px', margin: '0 auto', background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0'}}>
      <h2 style={{fontSize: '2rem', fontWeight: 900, color: '#0f172a', marginBottom: '10px', letterSpacing: '-1px'}}>⚙️ {t.navProfile}</h2>
      <p style={{color: '#64748b', marginBottom: '30px'}}>Zarządzaj swoimi danymi osobowymi oraz ustawieniami zabezpieczeń konta.</p>

      <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
        
        <label style={styles.labelWrapper}>
          <span style={styles.label}>{t.labelName}</span>
          <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={styles.input} required />
        </label>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
           <label style={{...styles.labelWrapper, flex: 1, minWidth: '250px'}}>
            <span style={styles.label}>{t.labelEmail}</span>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={styles.input} required />
          </label>
          <label style={{...styles.labelWrapper, flex: 1, minWidth: '250px'}}>
            <span style={styles.label}>{t.labelPhone}</span>
            <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={styles.input} required />
          </label>
        </div>

        <label style={styles.labelWrapper}>
          <span style={styles.label}>{t.labelPesel}</span>
          <input value={formData.pesel} onChange={e => setFormData({...formData, pesel: e.target.value})} maxLength={11} style={styles.input} required />
        </label>

        <div style={{marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px'}}>
            <h3 style={{fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '15px'}}>Zabezpieczenia</h3>
            <label style={styles.labelWrapper}>
            <span style={styles.label}>{t.labelPass} (Wpisz tylko, jeśli chcesz zmienić)</span>
            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={styles.input} placeholder="Nowe hasło..." />
            </label>
        </div>

        <button type="submit" style={styles.btnPrimary}>
          💾 Zapisz zmiany
        </button>
      </form>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  labelWrapper: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#0f172a', background: '#f8fafc', outline: 'none' },
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', marginTop: '10px', transition: 'background 0.2s' }
};