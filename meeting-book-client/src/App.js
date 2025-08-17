import React, { useState, useEffect } from 'react';
import CalendarView from './components/CalendarView';
import BookingForm from './components/BookingForm';
import ManualBookingForm from './components/ManualBookingForm';
import BookingActionModal from './components/BookingActionModal';
import FloorSelector from "./components/FloorSelector";
import LoginModal from './components/LoginModal';

import {
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';

import { db } from './utils/firebase';
import { sendEmail } from "./utils/email";
import './App.css';

const ADMIN_NOTIFICATION_CONFIG = [
  { email: "a.alkubaesy@swd.bh", floors: [7,10] },
  { email: "a.khaled@swd.bh", floors: [7,10] },
  { email: "a.qambar@swd.bh", floors: [7, 10] },
];

// ✅ Same-origin by default (works on new server without hardcoding)
const API_BASE =
  process.env.REACT_APP_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

const APP_URL =
  process.env.REACT_APP_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

function isAdminUser(email) {
  return ADMIN_NOTIFICATION_CONFIG.some(admin => admin.email === email);
}

function App() {
  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [, setUserLastBooking] = useState(null);
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(10);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("meetingUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      setIsAdmin(isAdminUser(parsed.username));
    }
  }, []);

  useEffect(() => {
    if (!selectedFloor) return;
    const collectionName = selectedFloor === 10 ? "bookings_floor10" : "bookings_floor7";
    const unsub = onSnapshot(collection(db, collectionName), snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(
        data.map(event => {
          const deptDisplay =
            event.department === "Other"
              ? event.customDepartment || "Other"
              : event.department;

          return {
            ...event,
            title: deptDisplay ? `${event.name} – ${deptDisplay}` : event.name,
          };
        })
      );
    });
    return () => unsub();
  }, [selectedFloor]);

  useEffect(() => {
    async function loadUserData() {
      if (!currentUser?.username) return;
      try {
        const userDocRef = doc(db, 'users', currentUser.username);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserLastBooking(data);
          setCurrentUser(prev => ({
            ...prev,
            department: data.department || prev?.department || "",
            customDepartment: data.customDepartment || ""
          }));
          localStorage.setItem("meetingUser", JSON.stringify({
            ...currentUser,
            department: data.department || "",
            customDepartment: data.customDepartment || ""
          }));
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    }
    loadUserData();
  }, [currentUser]);

  const handleLogin = async () => {
    const { username, password } = loginForm;
    if (!username || !password) {
      return alert("Please enter your username and password.");
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!data.success) return alert("Login failed: " + (data.message || "Invalid credentials."));

      const userInfo = {
        username: data.user.email,
        name: data.user.name,
        department: data.user.department || "",
      };

      setCurrentUser(userInfo);
      setIsAdmin(isAdminUser(userInfo.username));
      localStorage.setItem("meetingUser", JSON.stringify(userInfo));
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setLoginForm({ username: "", password: "" });
    localStorage.removeItem("meetingUser");
    window.location.reload();
  };

  const handleSlotSelect = (info) => {
    if (!currentUser) {
      alert("You must log in to book a meeting room.");
      return;
    }

    if (!info.resourceId) {
      alert("Please select a valid room.");
      return;
    }

    const start = new Date(info.start);
    if (start < new Date()) {
      alert("You cannot book a slot in the past.");
      return;
    }

    let end = new Date(info.end);
    if (start.getTime() === end.getTime()) {
      end = new Date(start.getTime() + 30 * 60 * 1000);
    }

    setSelectedSlot({
      start: start.toISOString(),
      end: end.toISOString(),
      resourceId: info.resourceId
    });
  };

  const notifyAdminsPendingBooking = async (userName, formData, slot, calculatedEnd, floor) => {
    const floorName = floor === 10 ? "10th Floor" : "7th Floor";
    const deptDisplay =
      formData.department === "Other" ? formData.customDepartment || "Other" : formData.department;

    const bookingDetails = `
New Booking Request (Pending)

Name: ${userName}
Email: ${currentUser?.username || "N/A"}
Department: ${deptDisplay}
Room: ${slot.resourceId}
Start: ${new Date(slot.start).toLocaleString()}
End: ${new Date(calculatedEnd).toLocaleString()}
Floor: ${floorName}
Purpose: ${formData.purpose || "-"}
Attendees: ${formData.attendees ?? "-"}

Review & manage bookings:
${APP_URL}
`;

    const adminsToNotify = ADMIN_NOTIFICATION_CONFIG
      .filter(admin => admin.floors.includes(floor))
      .map(admin => admin.email);

    for (const adminEmail of adminsToNotify) {
      const result = await sendEmail(
        adminEmail,
        `New Booking Request - ${floorName}`,
        bookingDetails,
        currentUser?.username
      );
      if (!result.success) {
        console.warn(`⚠ Failed to notify admin: ${adminEmail}`);
      }
    }
  };

  const handleSubmitBooking = async (formData, calculatedEnd) => {
    if (!currentUser) return alert("Please log in to book.");
    if (!selectedSlot || !selectedSlot.resourceId) {
      alert("Please select a room before booking.");
      return;
    }

    const userId = currentUser.username;
    const userName = currentUser.name;
    const collectionName = selectedFloor === 10 ? 'bookings_floor10' : 'bookings_floor7';

    await addDoc(collection(db, collectionName), {
      name: userName,
      department: formData.department === "Other" ? "Other" : formData.department,
      customDepartment: formData.department === "Other" ? formData.customDepartment : "",
      room: selectedSlot.resourceId,
      start: selectedSlot.start,
      end: calculatedEnd,
      userId,
      userEmail: currentUser.username,
      bookedBy: userName,
      floor: selectedFloor,
      status: "pending",
      purpose: formData.purpose || "",
      attendees: Number(formData.attendees) || 0
    });

    await setDoc(doc(db, 'users', userId), {
      name: userName,
      department: formData.department === "Other" ? "Other" : formData.department,
      customDepartment: formData.department === "Other" ? formData.customDepartment : "",
    });

    setUserLastBooking({
      name: userName,
      department: formData.department || currentUser.department || ""
    });

    setCurrentUser(prev => ({
      ...prev,
      department: formData.department || currentUser.department || ""
    }));

    localStorage.setItem("meetingUser", JSON.stringify({
      ...currentUser,
      department: formData.department || currentUser.department || ""
    }));

    await notifyAdminsPendingBooking(userName, formData, selectedSlot, calculatedEnd, selectedFloor);
    setSelectedSlot(null);
  };

  const handleEventDelete = async (eventId, floor) => {
    if (!isAdmin) return;
    try {
      const collectionName = floor === 10 ? 'bookings_floor10' : 'bookings_floor7';
      await deleteDoc(doc(db, collectionName, eventId));
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete booking.');
    }
  };

  return (
    <div>
      <header className="app-header">
        <div className="left-section">
          <img className="imgLogo" src="/logo.png" alt="App Logo" />
          <h2 className="titleheader">Meeting Booking System</h2>
        </div>

        {currentUser && currentUser.name ? (
          <div className="header-user-info">
            <span>
              Welcome, <strong>{currentUser.name}</strong>
              {isAdmin && <span className="admin-badge">( Admin )</span>}
            </span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <button className="login-btn" onClick={() => setLoginModalOpen(true)}>Login</button>
        )}
      </header>

      {isAdmin && selectedEvent && (
        <BookingActionModal
          eventData={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          events={events}
          adminEmail={currentUser?.username}
        />
      )}

      {!selectedFloor ? (
        <div style={{ textAlign: "center", margin: "20px" }}>
          <h3>Select Floor</h3>
          <button onClick={() => setSelectedFloor(10)}>10th Floor</button>
          <button onClick={() => setSelectedFloor(7)}>7th Floor</button>
        </div>
      ) : (
        <>
          <FloorSelector selectedFloor={selectedFloor} onChange={setSelectedFloor} />
          <div className="login-wrapper" style={{ margin: "10px 0" }}>
            <button
              onClick={() => {
                if (!currentUser) {
                  alert("Please log in first.");
                  return;
                }
                setManualBookingOpen(true);
              }}
            >
              Book Manually
            </button>
          </div>
          <CalendarView
            events={events}
            onSelectSlot={handleSlotSelect}
            onDeleteEvent={handleEventDelete}
            isAdmin={isAdmin}
            currentUser={currentUser}
            setSelectedEvent={setSelectedEvent}
            selectedFloor={selectedFloor}
          />

          {currentUser && selectedSlot && (
            <BookingForm
              slot={selectedSlot}
              events={events}
              onClose={() => setSelectedSlot(null)}
              onSubmit={handleSubmitBooking}
              loggedInUser={currentUser}
            />
          )}

          {manualBookingOpen && (
            <ManualBookingForm
              onClose={() => setManualBookingOpen(false)}
              onSubmit={(slot) => setSelectedSlot(slot)}
              selectedFloor={selectedFloor}
            />
          )}

          <LoginModal
            open={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            onLogin={() => {
              setLoginModalOpen(false);
              handleLogin();
            }}
          />
        </>
      )}
    </div>
  );
}

export default App;
