import React, { useState, useEffect } from 'react';
import CalendarView from './components/CalendarView';
import BookingForm from './components/BookingForm';
import ManualBookingForm from './components/ManualBookingForm';
import { db } from './utils/firebase';
import { loginRequest } from "./utils/msalConfig";
import BookingActionModal from './components/BookingActionModal';
import FloorSelector from "./components/FloorSelector";

import {
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import './App.css';
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { sendPendingEmail } from "./utils/email";  // Use NodeMailer for pending emails

const ADMIN_NOTIFICATION_CONFIG = [
  { email: "a.alkubaesy@swd.bh", floors: [7, 10] },
  { email: "m.adil@swd.bh", floors: [7, 10] },
];

// Helper to check if the current profile is an admin
function isAdminUser(email) {
  return ADMIN_NOTIFICATION_CONFIG.some(admin => admin.email === email);
}

// Fetch user profile with MSAL
async function getUserProfile(instance, account) {
  const request = { ...loginRequest, account };
  try {
    const response = await instance.acquireTokenSilent(request);
    const userInfo = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${response.accessToken}` },
    });
    return userInfo.json();
  } catch (error) {
    console.warn("Silent token acquisition failed:", error);
    if (error instanceof InteractionRequiredAuthError) {
      try {
        const response = await instance.acquireTokenPopup(request);
        const userInfo = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${response.accessToken}` },
        });
        return userInfo.json();
      } catch (popupError) {
        console.error("Popup token acquisition failed:", popupError);
        return null;
      }
    }
    return null;
  }
}

function App() {
  const { instance, accounts } = useMsal();
  const [activeAccount, setActiveAccount] = useState(instance.getActiveAccount() || accounts[0]);
  const [events, setEvents] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userLastBooking, setUserLastBooking] = useState(null);
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(10);
  const [accessToken, setAccessToken] = useState(null);

  // Fetch Microsoft user profile after login
  useEffect(() => {
    if (activeAccount) {
      getUserProfile(instance, activeAccount)
        .then(profile => {
          if (!profile || !profile.userPrincipalName) return console.error("Invalid profile data");

          if (!profile.userPrincipalName.endsWith("@swd.bh")) {
            alert("Access denied. Only @swd.bh emails are allowed.");
            handleLogout();
            return;
          }

          setCurrentUser(prev => ({
            ...prev,
            username: profile.userPrincipalName || "",
            name: profile.displayName || "Unknown User",
            department: prev?.department || profile.department || "",
            phone: profile.mobilePhone || prev?.phone || "",
          }));

          setIsAdmin(isAdminUser(profile.userPrincipalName));
        })
        .catch(err => console.error("Profile fetch failed:", err));
    }
  }, [activeAccount, instance]);

  // Load saved user data from Firestore
  useEffect(() => {
    async function loadUserData() {
      if (!currentUser?.username) return;
      try {
        const userDocRef = doc(db, 'users', currentUser.username);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserLastBooking(data);
          setCurrentUser(prev => ({ ...prev, department: data.department || prev?.department || "" }));
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    }
    loadUserData();
  }, [currentUser]);

  // Firestore: Load bookings
  useEffect(() => {
    if (!selectedFloor) return;
    const collectionName = selectedFloor === 10 ? "bookings_floor10" : "bookings_floor7";
    const unsub = onSnapshot(collection(db, collectionName), snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(
        data.map(event => ({
          ...event,
          title: event.department ? `${event.name} – ${event.department}` : event.name,
        }))
      );
    });
    return () => unsub();
  }, [selectedFloor]);

  // Microsoft Login
  const handleMicrosoftLogin = () => {
    instance.loginPopup(loginRequest)
      .then(async response => {
        instance.setActiveAccount(response.account);
        setActiveAccount(response.account);
        const tokenResponse = await instance.acquireTokenSilent(loginRequest);
        setAccessToken(tokenResponse.accessToken);
        return getUserProfile(instance, response.account);
      })
      .then(profile => {
        if (!profile) return alert("Failed to fetch Microsoft profile.");

        if (!profile.userPrincipalName.endsWith("@swd.bh")) {
          alert("Access denied. Only @swd.bh emails are allowed.");
          handleLogout();
          return;
        }

        setCurrentUser(prev => ({
          ...prev,
          username: profile.userPrincipalName || "",
          name: profile.displayName || "Unknown User",
          department: prev?.department || profile.department || "",
          phone: profile.mobilePhone || prev?.phone || "",
        }));

        setIsAdmin(isAdminUser(profile.userPrincipalName));
      })
      .catch(err => {
        console.error("Login failed:", err);
        alert("Microsoft login failed: " + err.message);
      });
  };

  const getFreshAccessToken = async () => {
    try {
      const tokenResponse = await instance.acquireTokenSilent(loginRequest);
      setAccessToken(tokenResponse.accessToken);
      return tokenResponse.accessToken;
    } catch (err) {
      console.error("Silent token refresh failed:", err);
      try {
        const tokenResponse = await instance.acquireTokenPopup(loginRequest);
        setAccessToken(tokenResponse.accessToken);
        return tokenResponse.accessToken;
      } catch (popupErr) {
        console.error("Token acquisition failed:", popupErr);
        return null;
      }
    }
  };

  const handleLogout = () => {
    instance.logoutPopup().then(() => {
      setCurrentUser(null);
      setActiveAccount(null);
    });
  };

  const handleSlotSelect = info => {
    if (!currentUser) return alert("You must log in to book a meeting room.");
    const start = new Date(info.start);
    let end = new Date(info.end);
    if (start.getTime() === end.getTime()) end = new Date(start.getTime() + 30 * 60 * 1000);
    setSelectedSlot({ start: start.toISOString(), end: end.toISOString(), resourceId: info.resource?.id || 'Room 1' });
  };

  // Notify admins about a pending booking
  const notifyAdminsPendingBooking = async (userName, formData, slot, calculatedEnd, floor) => {
    const floorName = floor === 10 ? "10th Floor" : "7th Floor";
    const bookingDetails = `
    New booking request (Pending)
    ---------------------------
    Name: ${userName}
    Email: ${currentUser?.username || "N/A"}
    Phone: ${formData.phone}
    CPR: ${formData.cpr}
    Department: ${formData.department || "N/A"}
    Room: ${slot.resourceId}
    Start: ${new Date(slot.start).toLocaleString()}
    End: ${new Date(calculatedEnd).toLocaleString()}
    Floor: ${floorName}
  `;

    const adminsToNotify = ADMIN_NOTIFICATION_CONFIG
      .filter(admin => admin.floors.includes(floor))
      .map(admin => admin.email);

    console.log("Admins to notify:", adminsToNotify);

    for (const adminEmail of adminsToNotify) {
      const success = await sendPendingEmail(adminEmail, `New Booking Request - ${floorName}`, bookingDetails);
      if (!success) {
        console.warn(`⚠ Failed to notify admin: ${adminEmail}`);
      }
    }
  };

  // Submit booking
  const handleSubmitBooking = async (formData, calculatedEnd) => {
    if (!currentUser) return alert("Please log in with your Microsoft account to book.");
    const userId = currentUser.username;
    const userName = currentUser.name;
    const collectionName = selectedFloor === 10 ? 'bookings_floor10' : 'bookings_floor7';

    await addDoc(collection(db, collectionName), {
      name: userName,
      cpr: formData.cpr,
      phone: formData.phone,
      department: formData.department || currentUser.department || "",
      room: selectedSlot.resourceId,
      start: selectedSlot.start,
      end: calculatedEnd,
      userId,
      userEmail: userId,
      bookedBy: userName,
      floor: selectedFloor,
      status: "pending"
    });

    await setDoc(doc(db, 'users', userId), {
      name: userName,
      cpr: formData.cpr,
      phone: formData.phone,
      department: formData.department || currentUser.department || ""
    });

    setUserLastBooking({
      name: userName,
      cpr: formData.cpr,
      phone: formData.phone,
      department: formData.department || currentUser.department || ""
    });

    setCurrentUser(prev => ({
      ...prev,
      department: formData.department || currentUser.department || ""
    }));

    await notifyAdminsPendingBooking(userName, formData, selectedSlot, calculatedEnd, selectedFloor);
    setSelectedSlot(null);
  };

  // Delete event (Admin only)
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
      <header style={{
        background: "#2e3b4e",
        color: "#fff",
        padding: "10px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h2 style={{ color: "white" }}>Meeting Booking System</h2>
        {currentUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>
              Welcome, <strong>{currentUser.name}</strong>
              {isAdmin && <span className="admin-badge"> (Admin)</span>}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: "#e74c3c",
                color: "#fff",
                border: "none",
                padding: "5px 10px",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={handleMicrosoftLogin}
            style={{
              background: "#3498db",
              color: "#fff",
              border: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Login with Microsoft
          </button>
        )}
      </header>

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

      {isAdmin && selectedEvent && (
        <BookingActionModal
          eventData={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          events={events}
          accessToken={accessToken}
          getFreshAccessToken={getFreshAccessToken}
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

          <CalendarView
            events={events}
            onSelectSlot={handleSlotSelect}
            onDeleteEvent={handleEventDelete}
            isAdmin={isAdmin}
            currentUser={currentUser}
            setSelectedEvent={setSelectedEvent}
            selectedFloor={selectedFloor}
          />

          {currentUser && (
            <BookingForm
              slot={selectedSlot}
              events={events}
              onClose={() => setSelectedSlot(null)}
              onSubmit={handleSubmitBooking}
              lastUsedData={userLastBooking ? { ...userLastBooking, name: currentUser?.name || userLastBooking.name } : { name: currentUser?.name || "", phone: currentUser?.phone || "", department: currentUser?.department || "", cpr: "" }}
            />
          )}

          {manualBookingOpen && (
            <ManualBookingForm
              onClose={() => setManualBookingOpen(false)}
              onSubmit={(slot) => setSelectedSlot(slot)}
              selectedFloor={selectedFloor}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
