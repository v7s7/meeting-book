import React from "react";
import { updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../utils/firebase";
import "./BookingActionModal.css";
import { sendGraphEmail } from "../utils/email";  // Use Graph API for admin emails

function BookingActionModal({ eventData, onClose, events, accessToken, getFreshAccessToken, adminEmail }) {
  if (!eventData) return null;

  // Approve booking
  const approveBooking = async () => {
    try {
      const floorCollection = eventData.floor === 10 ? "bookings_floor10" : "bookings_floor7";
      await updateDoc(doc(db, floorCollection, eventData.id), { status: "approved" });

      // Send approval email to user via Graph API
      if (eventData.userEmail) {
        const userMessage = `Hello ${eventData.name},\n\nYour booking for ${eventData.room} from ${new Date(
          eventData.start
        ).toLocaleString()} to ${new Date(
          eventData.end
        ).toLocaleString()} has been approved.\n\nThank you.`;

        await sendGraphEmail(
          eventData.userEmail,
          "Your Booking is Approved",
          userMessage,
          accessToken,
          getFreshAccessToken
        );

        // Send a copy to the admin who approved
        if (adminEmail) {
          const adminMessage = `You approved the booking for ${eventData.name} (${eventData.room}) from ${new Date(
            eventData.start
          ).toLocaleString()} to ${new Date(
            eventData.end
          ).toLocaleString()} on floor ${eventData.floor}.`;

          await sendGraphEmail(
            adminEmail,
            "You Approved a Booking",
            adminMessage,
            accessToken,
            getFreshAccessToken
          );
        }
      }

      // Remove overlapping pending bookings for the same room/floor/time
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

  // Decline booking
  const removeBooking = async () => {
    try {
      const floorCollection = eventData.floor === 10 ? "bookings_floor10" : "bookings_floor7";
      await deleteDoc(doc(db, floorCollection, eventData.id));

      // Send decline email to user via Graph API
      if (eventData.userEmail) {
        const userMessage = `Hello ${eventData.name},\n\nUnfortunately, your booking for ${eventData.room} on ${new Date(
          eventData.start
        ).toLocaleString()} was declined.\n\nThank you.`;

        await sendGraphEmail(
          eventData.userEmail,
          "Your Booking Request Declined",
          userMessage,
          accessToken,
          getFreshAccessToken
        );

        // Send a copy to the admin who declined
        if (adminEmail) {
          const adminMessage = `You declined the booking for ${eventData.name} (${eventData.room}) on ${new Date(
            eventData.start
          ).toLocaleString()} (floor ${eventData.floor}).`;

          await sendGraphEmail(
            adminEmail,
            "You Declined a Booking",
            adminMessage,
            accessToken,
            getFreshAccessToken
          );
        }
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
        <p><strong>Name:</strong> {eventData.name}</p>
        <p><strong>Department:</strong> {eventData.department}</p>
        <p><strong>Room:</strong> {eventData.room}</p>
        <p><strong>Start:</strong> {new Date(eventData.start).toLocaleString()}</p>
        <p><strong>End:</strong> {new Date(eventData.end).toLocaleString()}</p>

        <div className="modal-actions">
          {eventData.status === "pending" && <button onClick={approveBooking}>Approve</button>}
          <button onClick={removeBooking}>Remove</button>
          <button className="btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default BookingActionModal;
