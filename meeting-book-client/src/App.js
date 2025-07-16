import React, { useState, useEffect } from 'react';
import CalendarView from './components/CalendarView';
import BookingForm from './components/BookingForm';
import { auth, db } from './utils/firebase';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';

const ADMIN_UIDS = ['NvC4POvuBtYbbkDvd8xTmvwVFq33']; // Replace with your actual admin UID

function App() {
  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAdmin(user && ADMIN_UIDS.includes(user.uid));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEvents(data);
    });

    return () => unsub();
  }, []);

  const handleSlotSelect = (info) => {
  console.log("HANDLE SLOT SELECT:", info);
  setSelectedSlot({
    start: info.start,
    end: info.end,
    resourceId: info.resourceId,
  });
};


  const handleSubmitBooking = async (formData, calculatedEnd) => {
    const userId = currentUser?.uid || 'guest';

    await addDoc(collection(db, 'bookings'), {
      title: formData.purpose,
      start: selectedSlot.start,
      end: calculatedEnd,
      name: formData.name,
      email: formData.email,
      purpose: formData.purpose,
      userId,
      room: selectedSlot.resourceId,
    });

    setSelectedSlot(null);
  };

  const handleEventDelete = async (eventId) => {
    if (!isAdmin) {
      alert('Only admins can delete bookings.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'bookings', eventId));
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete booking.');
    }
  };

  const handleCloseForm = () => setSelectedSlot(null);

  const handleAdminLogin = async () => {
    const email = prompt('Enter admin email:');
    const password = prompt('Enter password:');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div>
      <header style={{ padding: '10px 20px', display: 'flex', justifyContent: 'flex-end' }}>
        {currentUser ? (
          <button onClick={handleLogout}>Logout</button>
        ) : (
          <button onClick={handleAdminLogin}>Admin Sign In</button>
        )}
      </header>

      <CalendarView
        events={events}
        onSelectSlot={handleSlotSelect}
        onDeleteEvent={handleEventDelete}
        isAdmin={isAdmin}
      />

      <BookingForm
        slot={selectedSlot}
        events={events}
        onClose={handleCloseForm}
        onSubmit={handleSubmitBooking}
      />
    </div>
  );
}

export default App;
