import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import { SpeedInsights } from "@vercel/speed-insights/next"

type View = 'home' | 'directory' | 'list' | 'login' | 'register' | 'my-appointments' | 'check-guest' | 'doctor-panel' | 'profile' | 'reception-panel' | 'schedule' | 'patients-registry' | 'settings' | 'tv-view' | 'quick-search';

// MAPOWANIE: Przypisujemy stare "widoki" do nowych, prawdziwych adresów URL SEO-friendly
const viewToPath: Record<View, string> = {
  'home': '/',
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

  // Zgadywanie aktualnego "widoku" na podstawie URL, żeby podświetlenia w menu działały jak dawniej
  const currentView = (Object.keys(viewToPath) as View[]).find(key => viewToPath[key] === location.pathname) || 'home';

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

  useEffect(() => {
    loadUser();
    fetchDoctorsAndClinics();
  }, []);

  // NOWA FUNKCJA NAWIGACJI - Zgodna z React Routerem
  const handleNavigate = (view: View) => {
    handleCloseModal(); 
    
    if (view !== 'list' && view !== 'directory') {
      setPrefilledPatient(null);
    }

    setIsMenuOpen(false);
    setIsMobileMenuOpen(false); 
    setIsLangMenuOpen(false);
    
    navigateUrl(viewToPath[view]);
    window.scrollTo(0, 0); 
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

      if (fullUser.clinicId) {
        setSelectedClinicId(fullUser.clinicId);
      }
      
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

  // SPECJALNY WIDOK DLA TV (Przejmuje cały ekran, omija resztę strony)
  if (location.pathname === viewToPath['tv-view']) {
      return (
          <div className="tv-mode-wrapper">
              <Toaster position="top-center" />
              <TvQueueView />
              <button 
                onClick={() => handleNavigate('home')} 
                style={{position:'fixed', bottom: 10, right: 10, opacity: 0.1, border:'none', background:'none', color:'white', cursor: 'pointer'}}
              >
                Wyjdź z TV
              </button>
          </div>
      );
  }

  return (
    <div className="app-container" onClick={() => { setIsMenuOpen(false); setIsMobileMenuOpen(false); setIsLangMenuOpen(false); }} style={{fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', width: '100%', overflowX: 'hidden'}}> 
      <Toaster position="top-center" />
      
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

      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        {/* Czarny pasek */}
        <div style={{ background: '#020617', padding: '10px 5vw', color: 'white', fontSize: '0.85rem' }}>
          <div className="top-bar-mobile" style={{ maxWidth: '1440px', margin: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div className="top-bar-info" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <span style={{color: '#94a3b8'}}>📞 Info: {activeClinicData?.phone || '+48 22 111 22 33'}</span>
              
              {canSwitchClinic && (
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#60a5fa'}}>
                  📍 Lokalizacja:
                  <select 
                    value={selectedClinicId || ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedClinicId(val ? parseInt(val) : null);
                      handleNavigate('home');
                    }}
                    style={{ 
                      background: '#1e293b', 
                      border: '1px solid #334155', 
                      color: 'white', 
                      fontWeight: 'bold', 
                      fontSize: '0.9rem', 
                      cursor: 'pointer', 
                      outline: 'none',
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="" style={{ background: '#0f172a', color: 'white', padding: '10px' }}>
                      🌍 Wszystkie placówki
                    </option>
                    
                    {clinics.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#0f172a', color: 'white', padding: '10px' }}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="top-bar-flags" style={{position: 'relative'}}>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsLangMenuOpen(!isLangMenuOpen); }}
                style={{
                  background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '6px 12px', 
                  borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', 
                  fontWeight: 'bold', fontSize: '0.85rem'
                }}
              >
                <img src={`https://flagcdn.com/w20/${lang === 'EN' ? 'gb' : lang === 'UA' ? 'ua' : 'pl'}.png`} alt={lang} style={{width: '20px', borderRadius: '2px'}} /> 
                {lang} ▾
              </button>
              
              {isLangMenuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#1e293b', 
                  border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', zIndex: 1000, 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)', minWidth: '100px'
                }}>
                  {(['PL', 'EN', 'UA'] as Language[]).map(l => (
                    <div 
                      key={l}
                      onClick={() => { setLang(l); setIsLangMenuOpen(false); }}
                      style={{
                        padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', 
                        background: lang === l ? '#334155' : 'transparent', borderBottom: '1px solid #0f172a'
                      }}
                    >
                      <img src={`https://flagcdn.com/w20/${l === 'EN' ? 'gb' : l === 'UA' ? 'ua' : 'pl'}.png`} alt={l} style={{width: '20px', borderRadius: '2px'}} /> 
                      <span style={{fontWeight: lang === l ? 'bold' : 'normal', color: 'white'}}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Główne Menu */}
        <nav style={{ padding: '20px 5vw', maxWidth: '1440px', margin: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
          
          <div className="nav-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: 'auto' }}>
            <h1 onClick={() => handleNavigate('home')} style={{cursor: 'pointer', margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1px'}}>
              {activeClinicData?.name || t.title}
            </h1>
            
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: '#0f172a' }}>
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>

          <div className={`nav-links-container ${isMobileMenuOpen ? 'open' : ''}`} style={{display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end'}}>
            
            <div className="nav-links-mobile" style={{display: 'flex', gap: '25px', alignItems: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#475569'}}>
              <span onClick={() => handleNavigate('home')} style={{cursor: 'pointer', color: currentView === 'home' ? '#2563eb' : 'inherit', borderBottom: currentView === 'home' ? '2px solid #2563eb' : 'none', paddingBottom: '4px'}}>{t.navClinic}</span>
              <span onClick={() => handleNavigate('directory')} style={{cursor: 'pointer', color: currentView === 'directory' ? '#2563eb' : 'inherit', borderBottom: currentView === 'directory' ? '2px solid #2563eb' : 'none', paddingBottom: '4px'}}>{t.navOurDoctors}</span>
              <button className="btn-book-mobile" onClick={() => handleNavigate('list')} style={{cursor: 'pointer', color: 'white', background: '#2563eb', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem'}}>{t.bookBtn}</button>
            </div>

            <div className="navbar-user-mobile">
              {user ? (
                <div style={{position: 'relative'}}>
                  <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="btn-user-menu" style={{background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>
                    👤 {user.name} ({user.role}) ▾
                  </button>

                  {isMenuOpen && (
                    <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '250px', zIndex: 100, overflow: 'hidden' }}>
                      {user.role === 'DOCTOR' && (
                        <>
                            <div onClick={() => handleNavigate('doctor-panel')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>👨‍⚕️ Pilot Wizyt</div>
                            <div onClick={() => handleNavigate('schedule')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 Mój Grafik</div>
                        </>
                      )}
                      {user.role === 'RECEPTIONIST' && (
                        <>
                            <div onClick={() => handleNavigate('quick-search')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#16a34a', fontWeight: 'bold'}}>🔍 Wyszukaj Termin</div>
                            <div onClick={() => handleNavigate('reception-panel')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🏢 Radar Gabinetów</div>
                            <div onClick={() => handleNavigate('patients-registry')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🗂️ Kartoteka Pacjentów</div>
                            <div onClick={() => handleNavigate('schedule')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 Grafik Pracy</div>
                        </>
                      )}
                      {(user.role === 'MANAGER' || user.role === 'ADMIN') && (
                        <>
                            <div style={{fontSize:'0.75rem', color:'#94a3b8', padding:'10px 20px', textTransform:'uppercase', fontWeight:'bold', background: '#f8fafc'}}>Zarządzanie</div>
                            <div onClick={() => handleNavigate('quick-search')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#16a34a', fontWeight: 'bold'}}>🔍 Wyszukaj Termin</div>
                            <div onClick={() => handleNavigate('schedule')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 Planowanie Grafiku</div>
                            <div onClick={() => handleNavigate('patients-registry')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🗂️ Baza Pacjentów</div>
                            <div onClick={() => handleNavigate('reception-panel')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🏢 Podgląd Recepcji</div>
                            {user.role === 'ADMIN' && (
                              <>
                                <div onClick={() => handleNavigate('settings')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>⚙️ Ustawienia Systemu</div>
                                <div onClick={() => handleNavigate('tv-view')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#2563eb', fontWeight: 'bold'}}>📺 Uruchom Ekran TV</div>
                              </>
                            )}
                        </>
                      )}
                      {user.role === 'PATIENT' && (
                        <>
                           <div onClick={() => handleNavigate('list')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 {t.bookBtn}</div>
                           <div onClick={() => handleNavigate('my-appointments')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📋 {t.myAppointments}</div>
                        </>
                      )}
                      <div onClick={() => handleNavigate('profile')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>⚙️ {t.navProfile}</div>
                      <div onClick={handleLogout} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', color: '#dc2626', fontWeight: 'bold'}}>🚪 {t.logout}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="login-buttons-mobile" style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <button onClick={() => handleNavigate('check-guest')} className="btn-login-nav" style={{background: 'none', color: '#475569', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}>🔍 {t.checkGuestBtn}</button>
                  <button className="btn-logout" onClick={() => handleNavigate('login')} style={{background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>{t.login}</button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="main-content" style={{ flex: 1, boxSizing: 'border-box' }}>
        {/* NOWOŚĆ: Blok definiujący, jaki komponent wyświetla się pod danym linkiem */}
        <Routes>
          <Route path="/" element={
            <HomePage lang={lang} clinicData={activeClinicData} allClinics={clinics} onBookClick={() => handleNavigate('list')} onClinicSelect={(id) => { setSelectedClinicId(id); window.scrollTo(0, 0); }} />
          } />
          
          <Route path="/nasi-lekarze" element={
            <DoctorsDirectory lang={lang} doctors={clinicSpecificDoctors} onBookDirectly={(doc: Doctor, svc?: any) => { setPreselectedService(svc); setSelectedDoctor(doc); }} />
          } />
          
          <Route path="/umow-wizyte" element={
            <div style={{padding: '60px 5vw', maxWidth: '1440px', margin: 'auto', boxSizing: 'border-box', width: '100%'}}>
              {loading ? <div style={{textAlign:'center', padding: '50px'}}>Wczytywanie lekarzy...</div> : (
                <DoctorsList doctors={clinicSpecificDoctors} loading={loading} lang={lang} onBook={(doc) => { setPreselectedService(null); setSelectedDoctor(doc); }} />
              )}
            </div>
          } />

          <Route path="/logowanie" element={
            <div className="auth-container" style={{padding: '80px 20px'}}>
              <div className="auth-card" style={{margin: '0 auto'}}>
                <LoginForm onLoginSuccess={handleLoginSuccess} />
                <p style={{marginTop: '15px', textAlign: 'center'}}>
                  Nie masz konta? <span onClick={() => handleNavigate('register')} style={{color: '#2563eb', cursor: 'pointer', fontWeight: 'bold'}}>Zarejestruj się</span>
                </p>
              </div>
            </div>
          } />

          <Route path="/rejestracja" element={
            <div className="auth-container" style={{padding: '80px 20px'}}>
              <RegisterForm onSuccess={() => handleNavigate('login')} onSwitchToLogin={() => handleNavigate('login')} lang={lang} />
            </div>
          } />

          <Route path="/moj-profil" element={
            <div style={{padding: '50px 5vw'}}><UserProfile user={user} onUpdateUser={(updated: any) => setUser(updated)} lang={lang} /></div>
          } />

          <Route path="/panel-lekarza" element={
            user?.role !== 'DOCTOR' ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <DoctorDashboard />
          } />

          <Route path="/radar-gabinetow" element={
            !['RECEPTIONIST', 'ADMIN', 'MANAGER'].includes(user?.role) ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień recepcji.</p> : <ReceptionPanel user={user} onBookVisit={handleBookForPatient} />
          } />

          <Route path="/grafik" element={
            !user ? <p style={{padding: '50px', textAlign: 'center'}}>Zaloguj się.</p> : <SchedulePanel userRole={user.role} userId={user.id} />
          } />

          <Route path="/kartoteka" element={
            !['RECEPTIONIST', 'ADMIN', 'MANAGER'].includes(user?.role) ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <PatientsRegistry onBookVisit={handleBookForPatient} />
          } />

          <Route path="/ustawienia" element={
            user?.role !== 'ADMIN' ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : <AdminSettings onRefreshData={fetchDoctorsAndClinics} />
          } />

          <Route path="/wyszukaj-termin" element={
            !['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user?.role) ? <p style={{padding: '50px', textAlign: 'center'}}>Brak uprawnień.</p> : (
              <QuickSearch doctors={clinicSpecificDoctors} onBook={(doc, svc, date, time) => { setPreselectedService(svc); setPreselectedDate(date); setPreselectedTime(time); setSelectedDoctor(doc); }} />
            )
          } />

          <Route path="/sprawdz-wizyte" element={
            <div style={{maxWidth: '800px', width: '95%', margin: '80px auto'}}>
              <div style={{background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #e2e8f0'}}>
                <div style={{maxWidth: '500px', margin: '0 auto 30px auto'}}>
                  <h2 style={{color: '#2563eb', marginBottom: '10px', fontSize: '2rem', fontWeight: 900}}>{t.checkGuestTitle}</h2>
                  <form onSubmit={handleGuestCheckSubmit} style={{display: 'flex', gap:'10px'}}>
                    <input type="text" placeholder={t.peselPlaceholder} value={guestPeselInput} onChange={(e) => setGuestPeselInput(e.target.value.replace(/\D/g, ''))} maxLength={11} style={{flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'}}/>
                    <button type="submit" className="btn-logout" style={{width: 'auto', padding: '0 20px', background: '#0f172a', color: 'white', border: 'none'}}>{t.searchBtn}</button>
                  </form>
                </div>
                {activeGuestPesel && <div style={{textAlign: 'left', borderTop: '1px solid #e2e8f0', paddingTop: '20px'}}><MyAppointments lang={lang} guestPesel={activeGuestPesel} /></div>}
              </div>
            </div>
          } />

          <Route path="/moje-wizyty" element={
            <div style={{padding: '50px 0'}}><MyAppointments lang={lang} /></div>
          } />
        </Routes>
      </main>

      <footer style={{ background: '#020617', color: 'white', padding: '80px 5vw 30px 5vw', borderTop: '1px solid #1e293b', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1440px', margin: 'auto', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', marginBottom: '50px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{fontSize: '2rem', fontWeight: 900, marginBottom: '15px', letterSpacing: '-1px'}}>{activeClinicData?.name || t.title}.</h2>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>Nowoczesna opieka medyczna i innowacyjny system rejestracji gwarantujący brak kolejek.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#60a5fa' }}>Nawigacja</h4>
              <span onClick={() => handleNavigate('home')} style={{ color: '#94a3b8', cursor: 'pointer', marginBottom: '10px' }}>{t.navClinic}</span>
              <span onClick={() => handleNavigate('directory')} style={{ color: '#94a3b8', cursor: 'pointer', marginBottom: '10px' }}>{t.navOurDoctors}</span>
              <span onClick={() => handleNavigate('list')} style={{ color: '#94a3b8', cursor: 'pointer', marginBottom: '10px' }}>{t.bookBtn}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#60a5fa' }}>Kontakt</h4>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                {activeClinicData?.address || 'ul. Zdrowa 15, 00-123 Warszawa'}<br/>
                📞 {activeClinicData?.phone || '+48 22 111 22 33'}<br/>
                📧 {activeClinicData?.email || 'centrala@medclinic.pl'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>&copy; {new Date().getFullYear()} MedClinic. Wszelkie prawa zastrzeżone.</p>
            <button onClick={() => window.scrollTo(0, 0)} style={{ background: 'none', border: '1px solid #1e293b', color: '#94a3b8', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>↑</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// OPAKOWANIE APLIKACJI W ROUTER (Niezbędne do działania URL)
export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}