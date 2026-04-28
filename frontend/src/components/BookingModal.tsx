import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { translations, type Language } from '../translations';
import toast from 'react-hot-toast';

// Definicja typu Usługi (zgodna z backendem)
interface Service {
  id: number;
  name: string;
  price: string;
  duration: number;
  isNfz: boolean;
}

export interface BookingModalProps {
  doctor: any;
  user: any; 
  lang: Language;
  initialService?: any;
  initialDate?: string | null; // DODANE
  initialTime?: string | null; // DODANE
  onClose: () => void;
  onSuccess: () => void;
}

export function BookingModal({ 
  doctor, 
  user, 
  lang, 
  initialService, 
  initialDate, 
  initialTime, 
  onClose, 
  onSuccess 
}: BookingModalProps) {
  const t = translations[lang];

  // --- STANY PROCESU ---
  const [step, setStep] = useState(0); 
  const [selectedService, setSelectedService] = useState<Service | null>(null); // PRZYWRÓCONO!
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // --- STANY KALENDARZA I DANYCH ---
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [searchingNext, setSearchingNext] = useState(false);

  // DANE PACJENTA / GOŚCIA
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPesel, setGuestPesel] = useState('');
  
  // TELEFON
  const [phonePrefix, setPhonePrefix] = useState('+48');
  const [phoneNumber, setPhoneNumber] = useState('');

  // --- SMART SEARCH DLA PERSONELU ---
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  // Sprawdzamy, czy aktualnie "operujący" użytkownik to personel
  const isStaff = user && ['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user.role);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STAN DLA NUMERKU WIZYTY ---
  const [createdTicket, setCreatedTicket] = useState<string | null>(null);

  // --- NOWOŚĆ: Obsługa Wyszukiwarki (Usługa + Data + Czas) ---
  useEffect(() => {
    if (initialService) {
      setSelectedService(initialService);
      setStep(1);
    }
    if (initialDate) {
      setSelectedDate(new Date(initialDate));
    }
    if (initialTime) {
      setSelectedTime(initialTime);
      // Nie pobieramy na nowo slotów z backendu, bo wyszukiwarka nam je dała na tacy
      setAvailableSlots([initialTime]); 
    }
  }, [initialService, initialDate, initialTime]);

  // --- AUTO-UZUPEŁNIANIE DANYCH ---
  useEffect(() => {
    if (user) {
      // NAPRAWA: Jeśli 'user' to pracownik (np. recepcja), przerywamy! Nie wpisujemy danych Halinki.
      // (Jeśli to pacjent przekazany z Kartoteki, jego rola to 'PATIENT', więc przejdzie dalej).
      if (['RECEPTIONIST', 'MANAGER', 'ADMIN'].includes(user.role)) {
        return; 
      }

      // W przeciwnym razie wypełniamy dane pacjenta
      setGuestName(user.name || '');
      setGuestEmail(user.email || '');
      
      if (user.pesel) setGuestPesel(user.pesel);
      
      if (user.phone) {
        let rawPhone = user.phone;
        if (rawPhone.startsWith('+48')) {
          setPhonePrefix('+48');
          rawPhone = rawPhone.replace('+48', '');
        } else if (rawPhone.startsWith('+380')) {
          setPhonePrefix('+380');
          rawPhone = rawPhone.replace('+380', '');
        } else if (rawPhone.startsWith('+44')) {
          setPhonePrefix('+44');
          rawPhone = rawPhone.replace('+44', '');
        }
        setPhoneNumber(rawPhone.trim());
      }
    }
  }, [user]);

  useEffect(() => {
    if (step === 1 && selectedService) { 
      // Jeśli mamy initialTime z Wyszukiwarki, omijamy pobieranie przy pierwszym renderze
      if (initialTime && !availableSlots.includes(initialTime)) {
         return; 
      }
      fetchSlots(selectedDate);
      // Jeśli zmieniamy datę ręcznie z kalendarza, czyścimy wybrany czas
      if (!initialTime || selectedDate.toISOString().split('T')[0] !== initialDate) {
          setSelectedTime(null);
      }
    }
  }, [selectedDate, step, selectedService]);

  useEffect(() => {
    if (step === 1) {
      fetchMonthAvailability(selectedDate);
    }
  }, [step, selectedDate]); 

  // --- LOGIKA WYSZUKIWANIA PACJENTÓW ---
  const handlePatientSearch = async (val: string) => {
    setPatientSearchQuery(val);
    if (val.length >= 3) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://medclinic-demo.onrender.com/users/search-patients?q=${val}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (e) {
        console.error("Błąd wyszukiwania pacjentów");
      }
    } else {
      searchResults.length > 0 && setSearchResults([]);
    }
  };

  const selectPatientFromSearch = (p: any) => {
    setGuestName(p.name);
    setGuestEmail(p.email || '');
    setGuestPesel(p.pesel || '');
    
    if (p.phone) {
      if (p.phone.startsWith('+48')) {
        setPhonePrefix('+48');
        setPhoneNumber(p.phone.replace('+48', ''));
      } else if (p.phone.startsWith('+380')) {
        setPhonePrefix('+380');
        setPhoneNumber(p.phone.replace('+380', ''));
      } else {
        setPhoneNumber(p.phone);
      }
    }
    
    setSearchResults([]);
    setPatientSearchQuery('');
    toast.success(`Wybrano: ${p.name}`);
  };

  const fetchMonthAvailability = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const res = await fetch(`https://medclinic-demo.onrender.com/doctors/${doctor.id}/month-availability?year=${year}&month=${month}`);
      if (res.ok) {
        const busy = await res.json();
        setBusyDates(busy);
      }
    } catch (err) {
      console.error('Błąd pobierania dostępności miesiąca');
    }
  };

  const fetchSlots = async (date: Date) => {
    if (!selectedService) return; 

    setLoadingSlots(true);
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      const res = await fetch(`https://medclinic-demo.onrender.com/doctors/${doctor.id}/slots?date=${dateString}&serviceId=${selectedService.id}`);
      const data = await res.json();
      setAvailableSlots(data);
    } catch (err) {
      console.error(err);
      toast.error('Błąd pobierania grafiku');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleFindNextAvailable = async () => {
    setSearchingNext(true);
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`https://medclinic-demo.onrender.com/doctors/${doctor.id}/next-available?date=${dateString}`);
      const data = await res.json();

      if (data.availableDate) {
        const nextDate = new Date(data.availableDate);
        setSelectedDate(nextDate);
        fetchMonthAvailability(nextDate);
        toast.success(`Znaleziono termin: ${data.availableDate}`);
      } else {
        toast.error(data.message || 'Brak terminów w najbliższym czasie.');
      }
    } catch (err) {
      toast.error('Błąd wyszukiwania');
    } finally {
      setSearchingNext(false);
    }
  };

  const validateForm = () => {
    const peselRegex = /^\d{11}$/;
    if (!peselRegex.test(guestPesel)) {
      toast.error(t.errPesel);
      return false;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, ''); 
    if (phonePrefix === '+48' && cleanPhone.length !== 9) {
      toast.error(t.errPhonePL); 
      return false;
    }
    if (phonePrefix === '+380' && (cleanPhone.length < 9 || cleanPhone.length > 10)) {
      toast.error(t.errPhoneUA);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService) return toast.error('Błąd: Nie wybrano usługi');
    if (!selectedTime) return toast.error(t.errTime);
    if (!validateForm()) return;

    setIsSubmitting(true);

    const [hours, minutes] = selectedTime.split(':');
    const finalDate = new Date(selectedDate);
    finalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const appointmentData = {
      doctorId: doctor.id,
      serviceId: selectedService.id,
      date: finalDate.toISOString(),
      patientId: (user && user.role === 'PATIENT') ? user.id : undefined,
      guestName,
      guestEmail,
      guestPesel,
      guestPhone: `${phonePrefix}${phoneNumber}`, 
    };

    try {
      const response = await fetch('https://medclinic-demo.onrender.com/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(appointmentData),
      });

      if (response.ok) {
        const newAppt = await response.json();
        const ticketNumber = `W-${String(newAppt.id).padStart(3, '0')}`;
        setCreatedTicket(ticketNumber);
      } else {
        const errorData = await response.json();
        toast.error(`❌ Błąd: ${errorData.message}`); 
      }
    } catch (err) {
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePeselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 11) setGuestPesel(val);
  };

  // --- EKRAN SUKCESU Z NUMERKIEM ---
  // Kluczowe: wywołujemy onSuccess(), co w App.tsx zamknie modal i zrobi navigate()
  if (createdTicket) {
    return (
      <div style={styles.overlay} onClick={() => onSuccess()}>
        <div style={{...styles.modal, padding: '40px', textAlign: 'center', maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
          <h2 style={{color: 'var(--success)', fontSize: '2rem', marginBottom: '10px'}}>✅ Rezerwacja udana!</h2>
          <p style={{color: 'var(--text-sub)', marginBottom: '20px'}}>Oto bilet na wizytę (numer zostanie wywołany na ekranie w poczekalni):</p>
          
          <div style={{
            background: 'var(--bg-main)', border: '2px dashed #cbd5e1', borderRadius: 'var(--radius)', 
            padding: '30px', margin: '20px auto', display: 'inline-block'
          }}>
            <span style={{display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px'}}>Twój Numerek</span>
            <span style={{fontSize: '4rem', fontWeight: '900', color: 'var(--accent)', letterSpacing: '2px'}}>{createdTicket}</span>
          </div>

          <button onClick={() => onSuccess()} style={{...styles.primaryBtn, marginTop: '20px', width: '100%'}}>
            Zamknij i przejdź dalej
          </button>
        </div>
      </div>
    );
  }

  const renderServiceSelection = () => (
    <div style={{padding: '20px'}}>
      <h3 style={{marginTop: 0, marginBottom: '20px', color: 'var(--text-main)'}}>{t.selectServiceLabel}</h3>
      <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
        {doctor.services?.map((service: Service) => (
          <div 
            key={service.id}
            onClick={() => { setSelectedService(service); setStep(1); }}
            style={{
              padding: '20px', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'white', boxShadow: 'var(--shadow-sm)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div>
              <div style={{fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '5px'}}>
                {service.name}
              </div>
              <div style={{fontSize: '0.85rem', color: 'var(--text-sub)', display: 'flex', gap: '10px', alignItems: 'center'}}>
                <span>⏱ {service.duration} {t.durationMin}</span>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{
                fontWeight: 'bold', fontSize: '0.9rem',
                color: service.isNfz ? 'var(--success)' : 'var(--accent)',
                background: service.isNfz ? '#ecfdf5' : '#eff6ff',
                padding: '6px 14px', borderRadius: '30px', textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                {service.isNfz ? t.servicePriceFree : `${service.price} PLN`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="booking-modal-content">
        <div style={styles.header}>
          <div>
            <h3 style={{margin: 0, color: 'var(--text-main)'}}>{t.modalTitle}</h3>
            <span style={{color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: 500}}>{doctor.user.name}</span>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        {step === 0 ? (
          renderServiceSelection()
        ) : (
          <div className="booking-modal-grid" style={styles.contentGrid}>
            <div className="booking-modal-left" style={styles.leftColumn}>
              <button 
                onClick={() => setStep(0)} 
                style={{marginBottom: '15px', background: 'none', border: 'none', color: 'var(--text-sub)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem'}}
              >
                ← Wróć do usług
              </button>

              <div style={{background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid #e2e8f0', marginBottom: '20px'}}>
                <div style={{fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Wybrana usługa</div>
                <div style={{fontWeight: 700, color: 'var(--text-main)', marginTop: '4px'}}>{selectedService?.name}</div>
                <div style={{fontSize: '0.8rem', fontWeight: 600, color: selectedService?.isNfz ? 'var(--success)' : 'var(--accent)', marginTop: '2px'}}>
                  {selectedService?.isNfz ? 'NFZ' : `${selectedService?.price} PLN`} • {selectedService?.duration} min
                </div>
              </div>

              <h4 style={styles.subHeader}>{t.stepDate}</h4>
              <Calendar 
                onChange={(val) => setSelectedDate(val as Date)} 
                value={selectedDate}
                minDate={new Date()} 
                locale={lang === 'UA' ? 'uk' : lang === 'EN' ? 'en-US' : 'pl-PL'}
                tileDisabled={({ date, view }) => {
                  if (view === 'month') {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    return busyDates.includes(dateStr);
                  }
                  return false;
                }}
                onActiveStartDateChange={({ activeStartDate }) => {
                  if (activeStartDate) fetchMonthAvailability(activeStartDate);
                }}
              />
            </div>

            <div className="booking-modal-right" style={styles.rightColumn}>
              <h4 style={styles.subHeader}>
                {format(selectedDate, 'dd.MM.yyyy')}
              </h4>
              
              {loadingSlots ? (
                <div style={{padding: '20px', textAlign: 'center', color: 'var(--text-sub)'}}>Ładowanie terminów...</div>
              ) : availableSlots.length > 0 ? (
                <div className="slots-grid">
                  {availableSlots.map(time => (
                    <div 
                      key={time} 
                      className={`time-slot ${selectedTime === time ? 'selected' : ''}`}
                      onClick={() => setSelectedTime(time)}
                      style={{borderRadius: 'var(--radius)'}}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center', padding: '30px 10px', backgroundColor: 'white', 
                  borderRadius: 'var(--radius)', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{fontSize: '2rem'}}>📅</div>
                  <p style={{margin: 0, fontWeight: 600, color: 'var(--text-main)'}}>Brak wolnych terminów.</p>
                  <button 
                    onClick={handleFindNextAvailable} 
                    disabled={searchingNext}
                    style={{...styles.primaryBtn, width: '100%'}}
                  >
                    {searchingNext ? 'Szukanie...' : '🔍 Znajdź najbliższy termin'}
                  </button>
                </div>
              )}

              {selectedTime && (
                <div style={{marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px'}}>
                  {/* PANEL ZARZĄDZANIA PACJENTEM DLA PERSONELU */}
                  {isStaff && (
                    <div style={{marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                         <label style={{fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase'}}>
                            Wybór Pacjenta
                         </label>
                         <button 
                            type="button" 
                            onClick={() => setShowNewPatientForm(!showNewPatientForm)}
                            style={{background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 800, cursor: 'pointer', fontSize: '0.75rem', textTransform: 'uppercase'}}
                         >
                            {showNewPatientForm ? '← Wyszukaj istniejącego' : '➕ Dodaj Nowego w locie'}
                         </button>
                      </div>

                      {showNewPatientForm ? (
                         <div style={{fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '10px'}}>
                            Wypełnij formularz poniżej. Dane zostaną zapisane w bazie, a wizyta przypisana do tego pacjenta.
                         </div>
                      ) : (
                         <div style={{position: 'relative'}}>
                            <input 
                              style={{...styles.input, borderColor: 'var(--accent)', backgroundColor: '#eff6ff'}} 
                              placeholder="Wyszukaj: Nazwisko lub PESEL..." 
                              value={patientSearchQuery}
                              onChange={(e) => handlePatientSearch(e.target.value)}
                            />
                            {searchResults.length > 0 && (
                              <div style={styles.dropdown}>
                                {searchResults.map(p => (
                                  <div 
                                    key={p.id} 
                                    onClick={() => selectPatientFromSearch(p)} 
                                    style={styles.dropdownItem}
                                  >
                                    <div>
                                      <div style={{fontWeight: 700, color: 'var(--text-main)'}}>{p.name}</div>
                                      <div style={{fontSize: '0.7rem', color: 'var(--text-sub)'}}>PESEL: {p.pesel}</div>
                                    </div>
                                    <div style={{fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600}}>{p.phone}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                         </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <h4 style={styles.subHeader}>{t.stepDetails}</h4>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      <input 
                        style={styles.input} 
                        placeholder={t.namePlaceholder} 
                        value={guestName} onChange={e => setGuestName(e.target.value)} required 
                      />
                      <input 
                        style={styles.input} 
                        placeholder={t.peselPlaceholder}
                        value={guestPesel} 
                        onChange={handlePeselChange}
                        required
                      />
                      <div style={{display: 'flex', gap: '5px'}}>
                        <select 
                          style={{...styles.input, width: '95px', padding: '10px 5px'}} 
                          value={phonePrefix}
                          onChange={e => setPhonePrefix(e.target.value)}
                        >
                          <option value="+48">🇵🇱 +48</option>
                          <option value="+380">🇺🇦 +380</option>
                          <option value="+44">🇬🇧 +44</option>
                        </select>
                        <input 
                          style={styles.input} 
                          type="tel"
                          placeholder={t.phonePlaceholder} 
                          value={phoneNumber} 
                          onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                          required
                        />
                      </div>
                      <input 
                        type="email"
                        style={styles.input} 
                        placeholder="Adres e-mail" 
                        value={guestEmail} onChange={e => setGuestEmail(e.target.value)} 
                      />
                      <button type="submit" disabled={isSubmitting} className="btn-book" style={{marginTop: '10px', background: 'var(--accent)', color: 'white', padding: '14px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.5px'}}>
                        {isSubmitting ? t.loading : t.confirmBtn}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: any = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    backgroundColor: 'white', padding: '0', borderRadius: 'var(--radius)', width: '95%', maxWidth: '900px',
    boxShadow: 'var(--shadow-md)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
    border: '1px solid #e2e8f0'
  },
  header: {
    padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', lineHeight: 0.5, color: 'var(--text-sub)'
  },
  contentGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0'
  },
  leftColumn: {
    padding: '25px', borderRight: '1px solid #f1f5f9'
  },
  rightColumn: {
    padding: '25px', backgroundColor: '#fcfcfc', position: 'relative'
  },
  subHeader: {
    margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px'
  },
  input: {
    padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box',
    fontSize: '0.95rem', color: 'var(--text-main)', outline: 'none'
  },
  primaryBtn: { 
    background: 'var(--accent)', color: 'white', border: 'none', 
    padding: '12px 20px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)', zIndex: 1100,
    maxHeight: '200px', overflowY: 'auto'
  },
  dropdownItem: {
    padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  '@media (max-width: 700px)': {
    contentGrid: { gridTemplateColumns: '1fr' },
    leftColumn: { borderRight: 'none', borderBottom: '1px solid #f1f5f9' }
  }
};