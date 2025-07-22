import React from "react";
import { updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../utils/firebase";
import "./BookingActionModal.css";

function BookingActionModal({ eventData, onClose, events, accessToken, getFreshAccessToken }) {
  if (!eventData) return null;

  // Send email using Microsoft Graph API
  const sendEmail = async (to, subject, message) => {
  try {
    // Always get the latest token
    const token = accessToken || (await getFreshAccessToken());
    if (!token) {
      console.warn("No access token available for sending email.");
      return;
    }

const response = await fetch("/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        message,
        accessToken: token,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error("Email send failed:", errorDetails);
    }
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

const approveBooking = async () => {
  try {
    const floorCollection =
      eventData.floor === 10 ? "bookings_floor10" : "bookings_floor7";

    await updateDoc(doc(db, floorCollection, eventData.id), { status: "approved" });

    // Send approval email
    if (eventData.userEmail) {
      await sendEmail(
        eventData.userEmail,
        "Your Booking is Approved",
        `Hello ${eventData.name},\n\nYour booking for ${eventData.room} from ${new Date(
          eventData.start
        ).toLocaleString()} to ${new Date(
          eventData.end
        ).toLocaleTimeString()} has been approved.\n\nThank you.`
      );
    }

    // Remove overlapping pending bookings in the same floor
    const overlappingPending = events.filter(
      (e) =>
        e.id !== eventData.id &&
        e.status === "pending" &&
        e.room === eventData.room &&
        e.floor === eventData.floor &&
        new Date(e.start) < new Date(eventData.end) &&
        new Date(e.end) > new Date(eventData.start)
    );

    for (const booking of overlappingPending) {
      await deleteDoc(doc(db, floorCollection, booking.id));
    }
  } catch (error) {
    console.error("Error approving booking:", error);
  } finally {
    onClose();
  }
};

const removeBooking = async () => {
  try {
    const floorCollection =
      eventData.floor === 10 ? "bookings_floor10" : "bookings_floor7";

    await deleteDoc(doc(db, floorCollection, eventData.id));

    // Send decline email
    if (eventData.userEmail) {
      await sendEmail(
        eventData.userEmail,
        "Your Booking Request",
        `Hello ${eventData.name},\n\nUnfortunately, your booking for ${eventData.room} on ${new Date(
          eventData.start
        ).toLocaleString()} was declined.\n\nThank you.`
      );
    }
  } catch (error) {
    console.error("Error removing booking:", error);
  } finally {
    onClose();
  }
};


  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Booking Details</h3>
        <p>
          <strong>Name:</strong> {eventData.name}
        </p>
        <p>
          <strong>Department:</strong> {eventData.department}
        </p>
        <p>
          <strong>Room:</strong> {eventData.room}
        </p>
        <p>
          <strong>Start:</strong> {new Date(eventData.start).toLocaleString()}
        </p>
        <p>
          <strong>End:</strong> {new Date(eventData.end).toLocaleString()}
        </p>
        <div className="modal-actions">
          {eventData.status === "pending" && (
            <button onClick={approveBooking}>Approve</button>
          )}
          <button onClick={removeBooking}>Remove</button>
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BookingActionModal;
