import { useEffect, useState } from 'react';
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

function App() {
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
  
  const [currentView, setCurrentView] = useState<View>('home');
  const [guestPeselInput, setGuestPeselInput] = useState('');
  const [activeGuestPesel, setActiveGuestPesel] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [prefilledPatient, setPrefilledPatient] = useState<any>(null);

  // --- NAPRAWA: Centralna funkcja zamykająca ---
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

    if (window.location.pathname === '/tv') {
      setCurrentView('tv-view');
    }
  }, []);

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
      
      if (fullUser.role === 'DOCTOR') navigate('doctor-panel');
      else if (fullUser.role === 'RECEPTIONIST') navigate('reception-panel');
      else if (fullUser.role === 'MANAGER' || fullUser.role === 'ADMIN') navigate('schedule');
      else navigate('home');
    })
    .catch(err => {
      console.error(err);
      setUser(userData); 
      navigate('home');
    });
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    navigate('home');
    setIsMenuOpen(false);
    toast.success('Wylogowano pomyślnie');
  };

  // --- NAPRAWA: Navigate inteligentnie zarządza pamięcią ---
  const navigate = (view: View) => {
    handleCloseModal(); 
    
    // Zapominamy o wybranym pacjencie TYLKO, gdy wychodzimy z procesu rezerwacji
    if (view !== 'list' && view !== 'directory') {
      setPrefilledPatient(null);
    }

    setCurrentView(view);
    setIsMenuOpen(false);
    window.scrollTo(0, 0); 
  };

  const handleGuestCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestPeselInput.length !== 11) return toast.error(t.errPesel);
    setActiveGuestPesel(guestPeselInput);
  };

  const handleBookForPatient = (patient: any) => {
    setPrefilledPatient(patient);
    navigate('list');
    toast.success(`Wybrano: ${patient.name}. Wybierz lekarza.`);
  };

  const activeClinicData = clinics.find(c => c.id === selectedClinicId);
  const clinicSpecificDoctors = selectedClinicId 
  ? doctors.filter((d: any) => Number(d.clinicId) === Number(selectedClinicId)) 
  : doctors;
    
  const canSwitchClinic = !user || ['ADMIN', 'MANAGER', 'PATIENT'].includes(user.role);

  const renderContent = () => {
    if (currentView === 'tv-view') return <TvQueueView />;

    if (currentView === 'home') return (
      <HomePage 
        lang={lang} 
        clinicData={activeClinicData} 
        allClinics={clinics} 
        onBookClick={() => navigate('list')} 
        // ZMIANA: Przekazujemy funkcję do zmiany kliniki z widoku kafelków
        onClinicSelect={(id) => {
          setSelectedClinicId(id);
          window.scrollTo(0, 0); // Przewiń na górę po wyborze
        }} 
      />
    );

    if (currentView === 'directory') return <DoctorsDirectory lang={lang} doctors={clinicSpecificDoctors} onBookDirectly={(doc: Doctor, svc?: any) => { setPreselectedService(svc); setSelectedDoctor(doc); }} />;

    if (currentView === 'login') return (
      <div className="auth-container" style={{padding: '80px 20px'}}>
        <div className="auth-card" style={{margin: '0 auto'}}>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
          <p style={{marginTop: '15px', textAlign: 'center'}}>
                Nie masz konta? <span onClick={() => navigate('register')} style={{color: '#2563eb', cursor: 'pointer', fontWeight: 'bold'}}>Zarejestruj się</span>
          </p>
        </div>
      </div>
    );

    if (currentView === 'register') return (
      <div className="auth-container" style={{padding: '80px 20px'}}>
        <RegisterForm onSuccess={() => navigate('login')} onSwitchToLogin={() => navigate('login')} lang={lang} />
      </div>
    );

    if (currentView === 'profile') return <div style={{padding: '50px 5vw'}}><UserProfile user={user} onUpdateUser={(updated: any) => setUser(updated)} lang={lang} /></div>;

    if (currentView === 'doctor-panel') {
      if (user?.role !== 'DOCTOR') return <p>Brak uprawnień.</p>;
      return <DoctorDashboard />;
    }

    if (currentView === 'reception-panel') {
      if (!['RECEPTIONIST', 'ADMIN', 'MANAGER'].includes(user?.role)) return <p>Brak uprawnień recepcji.</p>;
      return <ReceptionPanel user={user} onBookVisit={handleBookForPatient} />;
    }

    if (currentView === 'schedule') {
        if (!user) return <p>Zaloguj się.</p>;
        return <SchedulePanel userRole={user.role} userId={user.id} />;
    }

    if (currentView === 'patients-registry') {
        if (!['RECEPTIONIST', 'ADMIN', 'MANAGER'].includes(user?.role)) return <p>Brak uprawnień.</p>;
        return <PatientsRegistry onBookVisit={handleBookForPatient} />;
    }

    if (currentView === 'settings') {
      if (user?.role !== 'ADMIN') return <p>Brak uprawnień.</p>;
      return <AdminSettings onRefreshData={fetchDoctorsAndClinics} />;
    }

    if (currentView === 'quick-search') {
        if (!['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user?.role)) return <p>Brak uprawnień.</p>;
        return (
            <QuickSearch 
                doctors={clinicSpecificDoctors} 
                onBook={(doc, svc, date, time) => {
                    setPreselectedService(svc);
                    setPreselectedDate(date);
                    setPreselectedTime(time);
                    setSelectedDoctor(doc);
                }} 
            />
        );
    }
    
    if (currentView === 'check-guest') return (
      <div style={{maxWidth: '800px', width: '95%', margin: '80px auto'}}>
        <div style={{background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #e2e8f0'}}>
          <div style={{maxWidth: '500px', margin: '0 auto 30px auto'}}>
            <h2 style={{color: '#2563eb', marginBottom: '10px', fontSize: '2rem', fontWeight: 900}}>{t.checkGuestTitle}</h2>
            <form onSubmit={handleGuestCheckSubmit} style={{display: 'flex', gap:'10px'}}>
              <input type="text" placeholder={t.peselPlaceholder} value={guestPeselInput} onChange={(e) => setGuestPeselInput(e.target.value.replace(/\D/g, ''))} maxLength={11} style={{flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none'}}/>
              <button type="submit" className="btn-logout" style={{width: 'auto', padding: '0 20px', background: '#0f172a', color: 'white', border: 'none'}}>{t.searchBtn}</button>
            </form>
          </div>
          {activeGuestPesel && <div style={{textAlign: 'left', borderTop: '1px solid #e2e8f0', paddingTop: '20px'}}><MyAppointments lang={lang} guestPesel={activeGuestPesel} /></div>}
        </div>
      </div>
    );

    if (currentView === 'my-appointments') return <div style={{padding: '50px 0'}}><MyAppointments lang={lang} /></div>;

    return (
      <div style={{padding: '60px 5vw', maxWidth: '1440px', margin: 'auto'}}>
        <header style={{ marginBottom: '2rem' }}>
          <h2 className="page-title" style={{fontSize: '2.5rem', fontWeight: 900, color: '#0f172a'}}>{t.doctorsTitle} {activeClinicData ? `- ${activeClinicData.name}` : ''}</h2>
          <p className="page-subtitle" style={{color: '#475569'}}>{t.subtitle}</p>
        </header>
        {loading ? <div style={{textAlign:'center', padding: '50px'}}>Wczytywanie lekarzy...</div> : (
          <DoctorsList doctors={clinicSpecificDoctors} loading={loading} lang={lang} onBook={(doc) => { setPreselectedService(null); setSelectedDoctor(doc); }} />
        )}
      </div>
    );
  };

  if (currentView === 'tv-view') {
      return (
          <div className="tv-mode-wrapper">
              <Toaster position="top-center" />
              {renderContent()}
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  navigate('home');
                }} 
                style={{position:'fixed', bottom: 10, right: 10, opacity: 0.1, border:'none', background:'none', color:'white', cursor: 'pointer'}}
              >
                Wyjdź z TV
              </button>
          </div>
      );
  }

  return (
    <div className="app-container" onClick={() => setIsMenuOpen(false)} style={{fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif'}}> 
      <Toaster position="top-center" />
      
      {/* NAPRAWA: Spójne zamykanie w onSuccess i onClose */}
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
            handleCloseModal(); // 1. Najpierw usuwamy doktora ze stanu (zamykamy modal)
            setPrefilledPatient(null); // <--- DODANE: Czyścimy pacjenta po udanej rezerwacji
            
            // 2. Potem nawigujemy (używając setTimeout, żeby React przetworzył zamknięcie)
            setTimeout(() => {
              const isStaff = user && ['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user.role);
              navigate(isStaff ? 'patients-registry' : 'my-appointments'); 
            }, 0);
          }}
        />
      )}

      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ background: '#020617', padding: '10px 5vw', color: 'white', fontSize: '0.85rem' }}>
          <div style={{ maxWidth: '1440px', margin: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <span style={{color: '#94a3b8'}}>📞 Info: {activeClinicData?.phone || '+48 22 111 22 33'}</span>
              
              {canSwitchClinic && (
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#60a5fa'}}>
                  📍 Lokalizacja:
                  <select 
                    value={selectedClinicId || ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedClinicId(val ? parseInt(val) : null);
                      navigate('home');
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
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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

            <div style={{display: 'flex', gap: '15px', cursor: 'pointer', fontWeight: 'bold', alignItems: 'center'}}>
              <span onClick={() => setLang('PL')} style={{opacity: lang === 'PL' ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '4px'}}>
              <img src="https://flagcdn.com/w20/pl.png" alt="PL" style={{width: '20px', borderRadius: '2px'}} /> PL
              </span>
              <span onClick={() => setLang('EN')} style={{opacity: lang === 'EN' ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '4px'}}>
              <img src="https://flagcdn.com/w20/gb.png" alt="EN" style={{width: '20px', borderRadius: '2px'}} /> EN
              </span>
              <span onClick={() => setLang('UA')} style={{opacity: lang === 'UA' ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '4px'}}>
              <img src="https://flagcdn.com/w20/ua.png" alt="UA" style={{width: '20px', borderRadius: '2px'}} /> UA
              </span>
            </div>
          </div>
        </div>

        <nav style={{ padding: '20px 5vw', maxWidth: '1440px', margin: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }} onClick={(e) => e.stopPropagation()}>
          <div style={{display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap'}}>
            <h1 onClick={() => navigate('home')} style={{cursor: 'pointer', margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1px'}}>
              {activeClinicData?.name || t.title}
            </h1>
            
            <div style={{display: 'flex', gap: '25px', alignItems: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#475569'}}>
              <span onClick={() => navigate('home')} style={{cursor: 'pointer', color: currentView === 'home' ? '#2563eb' : 'inherit', borderBottom: currentView === 'home' ? '2px solid #2563eb' : 'none', paddingBottom: '4px'}}>{t.navClinic}</span>
              <span onClick={() => navigate('directory')} style={{cursor: 'pointer', color: currentView === 'directory' ? '#2563eb' : 'inherit', borderBottom: currentView === 'directory' ? '2px solid #2563eb' : 'none', paddingBottom: '4px'}}>{t.navOurDoctors}</span>
              <button onClick={() => navigate('list')} style={{cursor: 'pointer', color: 'white', background: '#2563eb', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem'}}>{t.bookBtn}</button>
            </div>
          </div>

          <div className="navbar-user">
            {user ? (
              <div style={{position: 'relative'}}>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="btn-user-menu" style={{background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>
                  👤 {user.name} ({user.role}) ▾
                </button>

                {isMenuOpen && (
                  <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '250px', zIndex: 100, overflow: 'hidden' }}>
                    {user.role === 'DOCTOR' && (
                      <>
                          <div onClick={() => navigate('doctor-panel')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>👨‍⚕️ Pilot Wizyt</div>
                          <div onClick={() => navigate('schedule')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 Mój Grafik</div>
                      </>
                    )}
                    {user.role === 'RECEPTIONIST' && (
                      <>
                          <div onClick={() => navigate('quick-search')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#16a34a', fontWeight: 'bold'}}>🔍 Wyszukaj Termin</div>
                          <div onClick={() => navigate('reception-panel')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🏢 Radar Gabinetów</div>
                          <div onClick={() => navigate('patients-registry')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🗂️ Kartoteka Pacjentów</div>
                          <div onClick={() => navigate('schedule')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 Grafik Pracy</div>
                      </>
                    )}
                    {(user.role === 'MANAGER' || user.role === 'ADMIN') && (
                      <>
                          <div style={{fontSize:'0.75rem', color:'#94a3b8', padding:'10px 20px', textTransform:'uppercase', fontWeight:'bold', background: '#f8fafc'}}>Zarządzanie</div>
                          <div onClick={() => navigate('quick-search')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#16a34a', fontWeight: 'bold'}}>🔍 Wyszukaj Termin</div>
                          <div onClick={() => navigate('schedule')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 Planowanie Grafiku</div>
                          <div onClick={() => navigate('patients-registry')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🗂️ Baza Pacjentów</div>
                          <div onClick={() => navigate('reception-panel')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>🏢 Podgląd Recepcji</div>
                          {user.role === 'ADMIN' && (
                            <>
                              <div onClick={() => navigate('settings')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>⚙️ Ustawienia Systemu</div>
                              <div onClick={() => { window.history.pushState({}, '', '/tv'); navigate('tv-view'); }} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#2563eb', fontWeight: 'bold'}}>📺 Uruchom Ekran TV</div>
                            </>
                          )}
                      </>
                    )}
                    {user.role === 'PATIENT' && (
                      <>
                         <div onClick={() => navigate('list')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📅 {t.bookBtn}</div>
                         <div onClick={() => navigate('my-appointments')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>📋 {t.myAppointments}</div>
                      </>
                    )}
                    <div onClick={() => navigate('profile')} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9'}}>⚙️ {t.navProfile}</div>
                    <div onClick={handleLogout} className="menu-item" style={{padding: '12px 20px', cursor: 'pointer', color: '#dc2626', fontWeight: 'bold'}}>🚪 {t.logout}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                <button onClick={() => navigate('check-guest')} className="btn-login-nav" style={{background: 'none', color: '#475569', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}>🔍 {t.checkGuestBtn}</button>
                <button className="btn-logout" onClick={() => navigate('login')} style={{background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>{t.login}</button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="main-content" style={{ flex: 1 }}>{renderContent()}</main>

      <footer style={{ background: '#020617', color: 'white', padding: '80px 5vw 30px 5vw', borderTop: '1px solid #1e293b' }}>
        <div style={{ maxWidth: '1440px', margin: 'auto', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', marginBottom: '50px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{fontSize: '2rem', fontWeight: 900, marginBottom: '15px', letterSpacing: '-1px'}}>{activeClinicData?.name || t.title}.</h2>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>Nowoczesna opieka medyczna i innowacyjny system rejestracji gwarantujący brak kolejek.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#60a5fa' }}>Nawigacja</h4>
              <span onClick={() => navigate('home')} style={{ color: '#94a3b8', cursor: 'pointer', marginBottom: '10px' }}>{t.navClinic}</span>
              <span onClick={() => navigate('directory')} style={{ color: '#94a3b8', cursor: 'pointer', marginBottom: '10px' }}>{t.navOurDoctors}</span>
              <span onClick={() => navigate('list')} style={{ color: '#94a3b8', cursor: 'pointer', marginBottom: '10px' }}>{t.bookBtn}</span>
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

export default App;