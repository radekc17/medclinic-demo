// frontend/src/components/LoginForm.tsx
import { useState } from 'react';
import toast from 'react-hot-toast'; // <--- IMPORT

interface LoginFormProps {
  onLoginSuccess: (userData: any, token: string) => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Usunąłem stan 'error', bo teraz błędy pokazuje toast

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // SUKCES!
        toast.success(`Witaj ponownie, ${data.user.name}!`); // <--- TOAST
        onLoginSuccess(data.user, data.access_token);
      } else {
        // Błąd z backendu
        toast.error(data.message || 'Błąd logowania'); // <--- TOAST
      }
    } catch (err) {
      toast.error('Błąd połączenia z serwerem'); // <--- TOAST
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      <div className="doctor-card">
        <h2 style={{ color: '#0ea5e9', marginBottom: '20px' }}>Zaloguj się</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="email"
            placeholder="Adres email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            required
          />
          <input
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            required
          />
          
          <button type="submit" className="btn-book">
            Wejdź
          </button>
        </form>
      </div>
    </div>
  );
}