import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { translations, type Language } from '../translations'; 

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  lang: Language; 
}

export function RegisterForm({ onSuccess, onSwitchToLogin, lang }: RegisterFormProps) {
  const t = translations[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pesel, setPesel] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePeselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); 
    if (value.length <= 11) setPesel(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); 
    if (value.length <= 15) setPhone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pesel.length !== 11) {
      return toast.error(t.errPesel);
    }
    if (phone.length < 9) {
      return toast.error(t.errPhonePL);
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, pesel, phone }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t.success);
        onSuccess(); 
      } else {
        // FIX TS: t.error nie istnieje w translations, używamy fallbacku
        toast.error(data.message || 'Wystąpił błąd podczas rejestracji');
      }
    } catch (err) {
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '550px', margin: '0 auto', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <h2 style={{ color: '#0f172a', marginBottom: '10px', fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px' }}>Dołącz do nas</h2>
        <p style={{color: '#64748b', marginBottom: '30px'}}>Zarejestruj się, aby uzyskać pełny dostęp do historii leczenia i szybkiej rezerwacji.</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
            <label style={styles.label}>{t.labelName}</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              style={styles.input}
              placeholder="np. Jan Kowalski"
            />
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
            <label style={styles.label}>{t.labelEmail}</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={styles.input}
              placeholder="adres@email.com"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              <label style={styles.label}>{t.labelPesel}</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={pesel} 
                onChange={handlePeselChange} 
                required 
                style={styles.input}
                placeholder={t.peselPlaceholder}
              />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              <label style={styles.label}>{t.labelPhone}</label>
              <input 
                type="text" 
                inputMode="tel"
                value={phone} 
                onChange={handlePhoneChange} 
                required 
                style={styles.input}
                placeholder={t.phonePlaceholder}
              />
            </div>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
            <label style={styles.label}>{t.labelPassword}</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={styles.input}
              placeholder="Min. 8 znaków"
            />
          </div>

          <button type="submit" disabled={loading} style={styles.btnPrimary}>
            {loading ? 'Przetwarzanie...' : t.btnRegister}
          </button>
        </form>

        <div style={{marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', color: '#64748b'}}>
          {t.alreadyHaveAccount} 
          <button style={styles.btnText} onClick={onSwitchToLogin}>
            {t.switchToLogin}
          </button>
        </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  label: { fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#0f172a', background: '#f8fafc', outline: 'none' },
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' },
  btnText: { background: 'none', border: 'none', color: '#2563eb', fontWeight: 800, cursor: 'pointer', fontSize: '1rem', marginLeft: '5px' }
};