import React, { useState, useEffect } from 'react';
import CalendarView from './components/CalendarView';
import BookingForm from './components/BookingForm';
import ManualBookingForm from './components/ManualBookingForm';
import { db } from './utils/firebase';
import {
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import './App.css';
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

const ADMIN_EMAILS = ["a.alkubaesy@swd.bh", "admin2@swd.bh", "admin3@swd.bh"];// CHANGE THE EMAIL HERE 

async function getUserProfile(instance, account) {
  const request = { scopes: ["User.Read"], account: account };
  try {
    const response = await instance.acquireTokenSilent(request);
    const userInfo = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${response.accessToken}` },
    });
    return userInfo.json();
  } catch (error) {
    console.error("Silent token acquisition failed:", error);
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
    } else {
      return null;
    }
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

  // Test Firestore permissions
  useEffect(() => {
    async function testFirestore() {
      try {
        await addDoc(collection(db, "testCollection"), { test: "hello" });
        console.log("✅ Write test succeeded");
        const snapshot = await getDocs(collection(db, "testCollection"));
        console.log("✅ Read test succeeded. Docs count:", snapshot.size);
      } catch (error) {
        console.error("❌ Firestore test error:", error);
      }
    }
    testFirestore();
  }, []);

  // Fetch Microsoft user profile after login
  useEffect(() => {
    if (activeAccount) {
      getUserProfile(instance, activeAccount)
        .then(profile => {
          if (!profile || !profile.userPrincipalName) {
            console.error("Failed to retrieve profile or userPrincipalName missing.");
            return;
          }

          // Allow only @swd.bh emails
          if (!profile.userPrincipalName.endsWith("@swd.bh")) {
            alert("Access denied. Only @swd.bh emails are allowed.");
            handleLogout();
            return;
          }

          setCurrentUser({
            username: profile.userPrincipalName || "",
            name: profile.displayName || "Unknown User",
            department: profile.department || "",
            phone: profile.mobilePhone || "",
          });

          // Check if user is the admin
setIsAdmin(ADMIN_EMAILS.includes(profile.userPrincipalName));
        })
        .catch(err => console.error("Profile fetch failed:", err));
    }
  }, [activeAccount, instance]);

  // Load saved user data
  useEffect(() => {
    async function loadUserData() {
      if (!currentUser?.username) return;
      try {
        const userDocRef = doc(db, 'users', currentUser.username);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setUserLastBooking(userSnap.data());
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    }
    loadUserData();
  }, [currentUser]);

  // Firestore: Load bookings
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setEvents(
        data.map((event) => ({
          ...event,
          title: event.department
            ? `${event.name} – ${event.department}`
            : event.name,
        }))
      );

      if (currentUser) {
        const userBookings = data
          .filter((b) => b.userId === currentUser.username)
          .sort((a, b) => new Date(b.start) - new Date(a.start));

        if (userBookings.length > 0) {
          const { name, cpr, phone, department } = userBookings[0];
          setUserLastBooking({ name, cpr, phone, department });
        }
      }
    });

    return () => unsub();
  }, [currentUser]);

  // Microsoft Login
  const handleMicrosoftLogin = () => {
    instance.loginPopup({ scopes: ["User.Read"] })
      .then(response => {
        instance.setActiveAccount(response.account);
        setActiveAccount(response.account);
        return getUserProfile(instance, response.account);
      })
      .then(profile => {
        if (!profile) {
          alert("Failed to fetch Microsoft profile. Please try again.");
          return;
        }

        // Allow only @swd.bh emails
        if (!profile.userPrincipalName.endsWith("@swd.bh")) {
          alert("Access denied. Only @swd.bh emails are allowed.");
          handleLogout();
          return;
        }

        setCurrentUser({
          username: profile.userPrincipalName || "",
          name: profile.displayName || "Unknown User",
          department: profile.department || "",
          phone: profile.mobilePhone || "",
        });

        // Check admin
        setIsAdmin(profile.userPrincipalName === ADMIN_EMAILS);
      })
      .catch(err => {
        console.error("Login failed:", err);
        alert("Microsoft login failed: " + err.message);
      });
  };

  const handleLogout = () => {
    instance.logoutPopup().then(() => {
      setCurrentUser(null);
      setActiveAccount(null);
    });
  };

  // Slot selection
  const handleSlotSelect = (info) => {
    const start = new Date(info.start);
    let end = new Date(info.end);

    if (start.getTime() === end.getTime()) {
      end = new Date(start.getTime() + 30 * 60 * 1000);
    }

    setSelectedSlot({
      start: start.toISOString(),
      end: end.toISOString(),
      resourceId: info.resource?.id || info.resourceId || 'Room 1',
    });
  };

  // Submit booking
  const handleSubmitBooking = async (formData, calculatedEnd) => {
    if (!currentUser) {
      alert("Please log in with your Microsoft account to book.");
      return;
    }

    const userId = currentUser.username;
    const userName = currentUser.name;

    await addDoc(collection(db, 'bookings'), {
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

    setSelectedSlot(null);
  };

  // Delete event (Admin only)
  const handleEventDelete = async (eventId) => {
    if (!isAdmin) return; 
    try {
      await deleteDoc(doc(db, 'bookings', eventId));
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete booking.');
    }
  };

  return (
    <div>
      {/* Header */}
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
        <button onClick={() => setManualBookingOpen(true)}>Book Manually</button>
      </div>

      <CalendarView
        events={events}
        onSelectSlot={handleSlotSelect}
        onDeleteEvent={handleEventDelete}
        isAdmin={isAdmin}
        currentUser={currentUser}
      />

      <BookingForm
        slot={selectedSlot}
        events={events}
        onClose={() => setSelectedSlot(null)}
        onSubmit={handleSubmitBooking}
        lastUsedData={userLastBooking || {
          name: currentUser?.name || "",
          phone: currentUser?.phone || "",
          department: currentUser?.department || "",
          cpr: ""
        }}
      />

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
