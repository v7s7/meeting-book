import React, { useState, useEffect } from 'react';
import CalendarView from './components/CalendarView';
import BookingForm from './components/BookingForm';
import { auth, db } from './utils/firebase';
import { setDoc } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';
import ManualBookingForm from './components/ManualBookingForm';

import './App.css';
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
import UserAuthForm from './components/UserAuthForm';


const ADMIN_UIDS = ['NvC4POvuBtYbbkDvd8xTmvwVFq33']; // Replace with your actual admin UID

function App() {
  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
const [showUserLogin, setShowUserLogin] = useState(false);
const [userLastBooking, setUserLastBooking] = useState(null);
const [manualBookingOpen, setManualBookingOpen] = useState(false);


  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user);
    setIsAdmin(user && ADMIN_UIDS.includes(user.uid));

   if (user) {
  const ref = doc(db, 'users', user.uid);
  console.log("📥 Trying to get user profile for UID:", user.uid);

  try {
    const userDoc = await getDoc(ref);
    if (userDoc.exists()) {
      console.log("✅ Profile loaded:", userDoc.data());
      setUserLastBooking(userDoc.data());
    } else {
      console.log("⚠️ Profile not found for user:", user.uid);
    }
  } catch (err) {
    console.error("❌ Failed to get user profile:", err);
  }
}

  });

  return () => unsubscribe();
}, []);

  useEffect(() => {
  const unsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setEvents(
      data.map(event => ({
        ...event,
        title: `${event.name} – ${event.department}`
      }))
    );

    // 🔍 Save latest booking info for current user
    if (currentUser) {
      const userBookings = data
        .filter(b => b.userId === currentUser.uid)
        .sort((a, b) => new Date(b.start) - new Date(a.start)); // latest first

      if (userBookings.length > 0) {
        const { name, cpr, phone, department } = userBookings[0];
        setUserLastBooking({ name, cpr, phone, department });
      }
    }
  });

  return () => unsub();
}, [currentUser]);


  const handleSlotSelect = (info) => {
  const start = new Date(info.start);
  let end = new Date(info.end);

  // If user didn't drag — manually set a 30-minute slot
  if (start.getTime() === end.getTime()) {
    end = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins
  }

  setSelectedSlot({
    start: start.toISOString(),
    end: end.toISOString(),
    resourceId: info.resource?.id || 'Room 1',
  });
};



  const handleSubmitBooking = async (formData, calculatedEnd) => {
    const userId = currentUser?.uid || 'guest';

 await addDoc(collection(db, 'bookings'), {
  name: formData.name,
  cpr: formData.cpr,
  phone: formData.phone,
  department: formData.department,
  room: selectedSlot.resourceId,
  start: selectedSlot.start,
  end: calculatedEnd,
  userId
});

// ✅ Save user profile
if (currentUser?.uid) {
  try {
  await setDoc(doc(db, 'users', currentUser.uid), {
    name: formData.name,
    cpr: formData.cpr,
    phone: formData.phone,
    department: formData.department
  });
  console.log("✅ Profile saved successfully");
} catch (err) {
  console.error("❌ Failed to save profile:", err);
}

}

    setSelectedSlot(null);
  };

  const handleEventDelete = async (eventId) => {
  const event = events.find(e => e.id === eventId);

  const isOwner = currentUser?.uid && event?.userId === currentUser.uid;

  if (!isAdmin && !isOwner) {
    alert('You can only delete your own bookings.');
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
  if (!email) return;  // Exit if cancelled or empty

  const password = prompt('Enter password:');
  if (!password) return;  // Exit if cancelled or empty

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
   <div className="login-wrapper">
  {currentUser ? (
    <button onClick={handleLogout}>Logout</button>
  ) : (
    <>
      <button onClick={() => setShowUserLogin(true)}>User Login</button>
      <button onClick={handleAdminLogin}>Admin Sign In</button>
    </>
  )}

  {/* ✅ Show this for everyone */}
  <button onClick={() => setManualBookingOpen(true)}>Book Manually</button>
</div>


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
      lastUsedData={userLastBooking}
    />

    {showUserLogin && (
      <UserAuthForm onClose={() => setShowUserLogin(false)} />
    )}

    {manualBookingOpen && (
      <ManualBookingForm
        onClose={() => setManualBookingOpen(false)}
        onSubmit={(slot) => setSelectedSlot(slot)}
      />
    )}
  </div>
);

}

export default App;
