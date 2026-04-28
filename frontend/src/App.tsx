import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { UserProfile } from './components/UserProfile';
import { BookingModal } from './components/BookingModal';
import { MyAppointments } from './components/MyAppointments';
import { DoctorDashboard } from './components/DoctorDashboard';
import { HomePage } from './components/HomePage';
import { DoctorsList, type Doctor } from './components/DoctorsList';
import { DoctorsDirectory } from './components/DoctorsDirectory'; 
import { ReceptionPanel } from './components/ReceptionPanel';
import { SchedulePanel } from './components/SchedulePanel';
import { PatientsRegistry } from './components/PatientsRegistry';
import { AdminSettings } from './components/AdminSettings';
import { TvQueueView } from './components/TvQueueView'; 
import { QuickSearch } from './components/QuickSearch';
import { translations, type Language } from './translations';
import { Toaster, toast } from 'react-hot-toast'; 

type View = 'home' | 'directory' | 'list' | 'login' | 'register' | 'my-appointments' | 'check-guest' | 'doctor-panel' | 'profile' | 'reception-panel' | 'schedule' | 'patients-registry' | 'settings' | 'tv-view' | 'quick-search';

// MAPOWANIE: Ścieżki bez języka (będą doklejane dynamicznie)
const viewToPath: Record<View, string> = {
  'home': '',
  'directory': '/nasi-lekarze',
  'list': '/umow-wizyte',
  'login': '/logowanie',
  'register': '/rejestracja',
  'profile': '/moj-profil',
  'doctor-panel': '/panel-lekarza',
  'reception-panel': '/radar-gabinetow',
  'schedule': '/grafik',
  'patients-registry': '/kartoteka',
  'settings': '/ustawienia',
  'quick-search': '/wyszukaj-termin',
  'check-guest': '/sprawdz-wizyte',
  'my-appointments': '/moje-wizyty',
  'tv-view': '/tv'
};

function AppContent() {
  const navigateUrl = useNavigate();
  const location = useLocation();

  const [lang, setLang] = useState<Language>('PL');
  const t = translations[lang];

  const [user, setUser] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [preselectedService, setPreselectedService] = useState<any>(null); 
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [preselectedTime, setPreselectedTime] = useState<string | null>(null); 
  
  const [guestPeselInput, setGuestPeselInput] = useState('');
  const [activeGuestPesel, setActiveGuestPesel] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [prefilledPatient, setPrefilledPatient] = useState<any>(null);

  // Inteligentne wykrywanie aktywnego widoku do podświetleń w menu
  const currentView = (Object.keys(viewToPath) as View[]).find(key => 
    location.pathname.includes(viewToPath[key]) && viewToPath[key] !== ''
  ) || 'home';

  const handleCloseModal = () => {
    setSelectedDoctor(null);
    setPreselectedService(null);
    setPreselectedDate(null);
    setPreselectedTime(null);
  };

  const fetchDoctorsAndClinics = async () => {
    try {
      const [docsRes, clinicsRes] = await Promise.all([
        fetch('https://medclinic-demo.onrender.com/doctors'),
        fetch('https://medclinic-demo.onrender.com/clinics')
      ]);
      const docsData = await docsRes.json();
      const clinicsData = await clinicsRes.json();
      setDoctors(docsData);
      setClinics(clinicsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('https://medclinic-demo.onrender.com/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(userData => { 
        if (userData) {
          setUser(userData);
          if (userData.clinicId) {
            setSelectedClinicId(userData.clinicId);
          }
        }
      })
      .catch(err => console.error(err));
    }
  };

  useEffect(() => { loadUser(); fetchDoctorsAndClinics(); }, []);

  useEffect(() => {
    const parts = location.pathname.split('/');
    const urlLang = parts[1]?.toUpperCase();
    if (urlLang && ['PL', 'EN', 'UA'].includes(urlLang)) {
      if (urlLang !== lang) setLang(urlLang as Language);
    }
  }, [location.pathname]);

  useEffect(() => {
    const match = location.pathname.match(/\/klinika\/(\d+)/);
    if (match) {
      setSelectedClinicId(parseInt(match[1]));
    } else if (location.pathname.endsWith('/pl') || location.pathname.endsWith('/en') || location.pathname.endsWith('/ua') || location.pathname === '/') {
      setSelectedClinicId(null);
    }
  }, [location.pathname]);

  const handleNavigate = (view: View) => {
    handleCloseModal(); 
    if (view !== 'list' && view !== 'directory') {
      setPrefilledPatient(null);
    }
    setIsMenuOpen(false);
    setIsMobileMenuOpen(false); 
    setIsLangMenuOpen(false);
    
    navigateUrl(`/${lang.toLowerCase()}${viewToPath[view]}`);
    window.scrollTo(0, 0); 
  };

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    setIsLangMenuOpen(false);
    const parts = location.pathname.split('/');
    if (parts.length > 1 && ['pl', 'en', 'ua'].includes(parts[1])) {
      parts[1] = newLang.toLowerCase();
      navigateUrl(parts.join('/'));
    } else {
      navigateUrl(`/${newLang.toLowerCase()}`);
    }
  };

  const handleLoginSuccess = (userData: any, accessToken: string) => {
    localStorage.setItem('token', accessToken);
    fetch('https://medclinic-demo.onrender.com/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    .then(res => res.ok ? res.json() : userData)
    .then(fullUser => {
      setUser(fullUser);
      setIsMenuOpen(false);
      if (fullUser.clinicId) setSelectedClinicId(fullUser.clinicId);
      
      if (fullUser.role === 'DOCTOR') handleNavigate('doctor-panel');
      else if (fullUser.role === 'RECEPTIONIST') handleNavigate('reception-panel');
      else if (fullUser.role === 'MANAGER' || fullUser.role === 'ADMIN') handleNavigate('schedule');
      else handleNavigate('home');
    })
    .catch(err => {
      console.error(err);
      setUser(userData); 
      handleNavigate('home');
    });
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    handleNavigate('home');
    toast.success('Wylogowano pomyślnie');
  };

  const handleGuestCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestPeselInput.length !== 11) return toast.error(t.errPesel);
    setActiveGuestPesel(guestPeselInput);
  };

  const handleBookForPatient = (patient: any) => {
    setPrefilledPatient(patient);
    handleNavigate('list');
    toast.success(`Wybrano: ${patient.name}. Wybierz lekarza.`);
  };

  const activeClinicData = clinics.find(c => c.id === selectedClinicId);
  const clinicSpecificDoctors = selectedClinicId 
  ? doctors.filter((d: any) => Number(d.clinicId) === Number(selectedClinicId)) 
  : doctors;
    
  const canSwitchClinic = !user || ['ADMIN', 'MANAGER', 'PATIENT'].includes(user.role);

  if (location.pathname.includes('/tv')) {
      return (
          <div className="tv-mode-wrapper">
              <Toaster position="top-center" />
              <TvQueueView />
              <button onClick={() => handleNavigate('home')} style={{position:'fixed', bottom: 10, right: 10, opacity: 0.1, border:'none', background:'none', color:'white', cursor: 'pointer'}}>Wyjdź z TV</button>
          </div>
      );
  }

  const rawPhone = activeClinicData?.phone || '+48 22 111 22 33';
  const dialPhone = rawPhone.replace(/\s+/g, '');

  return (
    <div className="app-container modern-theme" onClick={() => { setIsMenuOpen(false); setIsMobileMenuOpen(false); setIsLangMenuOpen(false); }} style={{fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', width: '100%', overflowX: 'hidden'}}> 
      <Toaster position="top-center" toastOptions={{style: { borderRadius: '50px', background: '#333', color: '#fff' }}} />
      
      {selectedDoctor && (
        <BookingModal 
          doctor={selectedDoctor} 
          user={prefilledPatient || user} 
          lang={lang} 
          initialService={preselectedService}
          initialDate={preselectedDate}
          initialTime={preselectedTime}
          onClose={handleCloseModal}
          onSuccess={() => { 
            toast.success(t.success);
            handleCloseModal(); 
            setPrefilledPatient(null); 
            setTimeout(() => {
              const isStaff = user && ['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user.role);
              handleNavigate(isStaff ? 'patients-registry' : 'my-appointments'); 
            }, 0);
          }}
        />
      )}

      <header className="modern-header" style={{ background: 'rgba(255,255,255,0.98)', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        
        {/* TOP BAR INFO */}
        <div className="top-info-bar">
          <div className="header-container">
            <div className="top-info-left">
              <a href={`tel:${dialPhone}`} className="phone-pill">
                <span className="icon">📞</span>
                <span className="text">{rawPhone}</span>
              </a>
              
              {canSwitchClinic && (
                <div className="location-pill">
                  <span className="icon">📍</span>
                  <select 
                    value={selectedClinicId || ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) navigateUrl(`/${lang.toLowerCase()}/klinika/${val}`); 
                      else navigateUrl(`/${lang.toLowerCase()}`); 
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">Wszystkie placówki</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="top-info-right">
              <div className="lang-selector-modern">
                <button onClick={(e) => { e.stopPropagation(); setIsLangMenuOpen(!isLangMenuOpen); }}>
                  <img src={`https://flagcdn.com/w20/${lang === 'EN' ? 'gb' : lang === 'UA' ? 'ua' : 'pl'}.png`} alt={lang} /> 
                  <span className="lang-code">{lang}</span>
                </button>
                
                {isLangMenuOpen && (
                  <div className="lang-dropdown-modern">
                    {(['PL', 'EN', 'UA'] as Language[]).map(l => (
                      <div key={l} onClick={() => changeLanguage(l)} className="lang-option">
                        <img src={`https://flagcdn.com/w20/${l === 'EN' ? 'gb' : l === 'UA' ? 'ua' : 'pl'}.png`} alt={l} /> 
                        <span>{l}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN NAVBAR */}
        <nav className="main-navbar">
          <div className="header-container">
            <div className="brand" onClick={() => handleNavigate('home')}>
              <h1 className="logo-text">Med<span>Clinic</span></h1>
            </div>

            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>

            <div className={`nav-links-wrapper ${isMobileMenuOpen ? 'open' : ''}`}>
              <div className="primary-links">
                <span className="nav-item" onClick={() => handleNavigate('home')} style={{color: currentView === 'home' ? '#2563eb' : 'inherit'}}>{t.navClinic}</span>
                <span className="nav-item" onClick={() => handleNavigate('directory')} style={{color: currentView === 'directory' ? '#2563eb' : 'inherit'}}>{t.navOurDoctors}</span>
                <span className="nav-item" onClick={() => handleNavigate('check-guest')}>🔍 {t.checkGuestBtn}</span>
              </div>

              <div className="auth-actions">
                <button className="pill-btn-primary" onClick={() => handleNavigate('list')}>{t.bookBtn}</button>
                
                {user ? (
                  <div className="user-nav-container">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="pill-btn-outline user-btn">
                      👤 {user.name.split(' ')[0]} ▾
                    </button>
                    {isMenuOpen && (
                      <div className="user-dropdown-modern">
                        {user.role === 'DOCTOR' && (
                          <div onClick={() => handleNavigate('doctor-panel')} className="drop-item">👨‍⚕️ Pilot Wizyt</div>
                        )}
                        {['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user.role) && (
                          <div onClick={() => handleNavigate('quick-search')} className="drop-item highlight">🔍 Wyszukaj Termin</div>
                        )}
                        <div onClick={() => handleNavigate('profile')} className="drop-item">⚙️ {t.navProfile}</div>
                        <div onClick={handleLogout} className="drop-item logout">🚪 {t.logout}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => handleNavigate('login')} className="pill-btn-outline">{t.login}</button>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="app-main-content modern-bg" style={{ flex: 1, boxSizing: 'border-box' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/pl" replace />} />
          
          <Route path="/:lang" element={
            <HomePage lang={lang} clinicData={activeClinicData} allClinics={clinics} onBookClick={() => handleNavigate('list')} onClinicSelect={(id) => navigateUrl(`/${lang.toLowerCase()}/klinika/${id}`)} />
          } />
          <Route path="/:lang/klinika/:clinicId" element={
            <HomePage lang={lang} clinicData={activeClinicData} allClinics={clinics} onBookClick={() => handleNavigate('list')} onClinicSelect={(id) => navigateUrl(`/${lang.toLowerCase()}/klinika/${id}`)} />
          } />
          <Route path="/:lang/nasi-lekarze" element={
            <DoctorsDirectory lang={lang} doctors={clinicSpecificDoctors} onBookDirectly={(doc: Doctor, svc?: any) => { setPreselectedService(svc); setSelectedDoctor(doc); }} />
          } />
          <Route path="/:lang/umow-wizyte" element={
            <div style={{padding: '60px 5vw', maxWidth: '1440px', margin: 'auto', boxSizing: 'border-box', width: '100%'}}>
              {loading ? <div style={{textAlign:'center', padding: '50px'}}>Wczytywanie lekarzy...</div> : (
                <DoctorsList doctors={clinicSpecificDoctors} loading={loading} lang={lang} onBook={(doc) => { setPreselectedService(null); setSelectedDoctor(doc); }} />
              )}
            </div>
          } />
          <Route path="/:lang/logowanie" element={
            <div className="auth-container" style={{padding: '80px 20px'}}>
              <div className="auth-card" style={{margin: '0 auto', borderRadius: '24px', background: 'white', border: '1px solid #f1f5f9', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)'}}>
                <LoginForm onLoginSuccess={handleLoginSuccess} />
                <p style={{marginTop: '15px', textAlign: 'center'}}>Nie masz konta? <span onClick={() => handleNavigate('register')} style={{color: '#2563eb', cursor: 'pointer', fontWeight: 'bold'}}>Zarejestruj się</span></p>
              </div>
            </div>
          } />
          <Route path="/:lang/rejestracja" element={
            <div className="auth-container" style={{padding: '80px 20px'}}>
              <RegisterForm onSuccess={() => handleNavigate('login')} onSwitchToLogin={() => handleNavigate('login')} lang={lang} />
            </div>
          } />
          <Route path="/:lang/moj-profil" element={
            <div style={{padding: '50px 5vw'}}><UserProfile user={user} onUpdateUser={(updated: any) => setUser(updated)} lang={lang} /></div>
          } />
          <Route path="/:lang/panel-lekarza" element={user?.role !== 'DOCTOR' ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <DoctorDashboard />} />
          <Route path="/:lang/radar-gabinetow" element={!['RECEPTIONIST', 'ADMIN', 'MANAGER'].includes(user?.role) ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień recepcji.</p> : <ReceptionPanel user={user} onBookVisit={handleBookForPatient} />} />
          <Route path="/:lang/grafik" element={!user ? <p style={{padding: '50px', textAlign: 'center'}}>Zaloguj się.</p> : <SchedulePanel userRole={user.role} userId={user.id} />} />
          <Route path="/:lang/kartoteka" element={!['RECEPTIONIST', 'ADMIN', 'MANAGER'].includes(user?.role) ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <PatientsRegistry onBookVisit={handleBookForPatient} />} />
          <Route path="/:lang/ustawienia" element={user?.role !== 'ADMIN' ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <AdminSettings onRefreshData={fetchDoctorsAndClinics} />} />
          <Route path="/:lang/wyszukaj-termin" element={!['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user?.role) ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <QuickSearch doctors={clinicSpecificDoctors} onBook={(doc, svc, date, time) => { setPreselectedService(svc); setPreselectedDate(date); setPreselectedTime(time); setSelectedDoctor(doc); }} />} />
          <Route path="/:lang/sprawdz-wizyte" element={
            <div style={{maxWidth: '800px', width: '95%', margin: '80px auto'}}>
              <div style={{background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', textAlign: 'center', border: '1px solid #f1f5f9'}}>
                <div style={{maxWidth: '500px', margin: '0 auto 30px auto'}}>
                  <h2 style={{color: '#0f172a', marginBottom: '10px', fontSize: '2rem', fontWeight: 900}}>{t.checkGuestTitle}</h2>
                  <form onSubmit={handleGuestCheckSubmit} style={{display: 'flex', gap:'10px'}}>
                    <input type="text" placeholder={t.peselPlaceholder} value={guestPeselInput} onChange={(e) => setGuestPeselInput(e.target.value.replace(/\D/g, ''))} maxLength={11} style={{flex: 1, padding: '16px', borderRadius: '50px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'}}/>
                    <button type="submit" className="pill-btn-primary" style={{width: 'auto'}}>{t.searchBtn}</button>
                  </form>
                </div>
                {activeGuestPesel && <div style={{textAlign: 'left', borderTop: '1px solid #f1f5f9', paddingTop: '20px'}}><MyAppointments lang={lang} guestPesel={activeGuestPesel} /></div>}
              </div>
            </div>
          } />
          <Route path="/:lang/moje-wizyty" element={<div style={{padding: '50px 0'}}><MyAppointments lang={lang} /></div>} />
        </Routes>
      </main>

      <footer style={{ background: 'white', color: '#475569', padding: '80px 5vw 30px 5vw', borderTop: '1px solid #f1f5f9', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1440px', margin: 'auto', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', marginBottom: '50px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{fontSize: '2rem', fontWeight: 900, marginBottom: '15px', color: '#2563eb', letterSpacing: '-1px'}}>MedClinic.</h2>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>Nowoczesna opieka medyczna i innowacyjny system rejestracji gwarantujący brak kolejek i pełne poczucie bezpieczeństwa.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#0f172a' }}>Nawigacja</h4>
              <span onClick={() => handleNavigate('home')} style={{ cursor: 'pointer', marginBottom: '10px', fontWeight: 600 }}>{t.navClinic}</span>
              <span onClick={() => handleNavigate('directory')} style={{ cursor: 'pointer', marginBottom: '10px', fontWeight: 600 }}>{t.navOurDoctors}</span>
              <span onClick={() => handleNavigate('list')} style={{ cursor: 'pointer', marginBottom: '10px', fontWeight: 600 }}>{t.bookBtn}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#0f172a' }}>Kontakt</h4>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: 0, fontWeight: 600 }}>
                {activeClinicData?.address || 'ul. Zdrowa 15, 00-123 Warszawa'}<br/>
                <a href={`tel:${dialPhone}`} style={{textDecoration: 'none', color: 'inherit'}}>📞 {rawPhone}</a>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
            <p style={{ fontSize: '0.8rem', margin: 0 }}>&copy; {new Date().getFullYear()} MedClinic. Wszelkie prawa zastrzeżone.</p>
            <button onClick={() => window.scrollTo(0, 0)} className="pill-btn-outline" style={{ padding: '8px 16px' }}>↑ Do góry</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}