import React from "react";
import { updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../utils/firebase";
import "./BookingActionModal.css";
import { sendEmail } from "../utils/email";

function BookingActionModal({ eventData, onClose, events, adminEmail }) {
  if (!eventData) return null;

  const approveBooking = () => {
    onClose();

    (async () => {
      try {
        const floorCollection = eventData.floor === 10 ? "bookings_floor10" : "bookings_floor7";
        await updateDoc(doc(db, floorCollection, eventData.id), { status: "approved" });

        if (eventData.userEmail) {
          const userMessage = `Hello ${eventData.name},\n\nYour booking for ${eventData.room} from ${new Date(
            eventData.start
          ).toLocaleString()} to ${new Date(eventData.end).toLocaleString()} has been approved.\n\nThank you.`;

          const result = await sendEmail(
            eventData.userEmail,
            "Your Booking is Approved",
            userMessage,
            adminEmail // ✅ send from admin
          );
          if (!result.success) {
            console.error("Failed to send user approval email:", result.error);
            alert("Booking approved, but the email notification to the user failed.");
          }

          const adminMessage = `You approved the booking for ${eventData.name} (${eventData.room}) from ${new Date(
            eventData.start
          ).toLocaleString()} to ${new Date(eventData.end).toLocaleString()} on floor ${eventData.floor}.`;

          await sendEmail(adminEmail, "You Approved a Booking", adminMessage, adminEmail);
        }

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

          if (booking.userEmail) {
            const message = `Hello ${booking.name},\n\nYour booking for ${booking.room} on ${new Date(
              booking.start
            ).toLocaleString()} was automatically declined because another booking was approved for that time.\n\nThank you.`;

            await sendEmail(
              booking.userEmail,
              "Booking Request Declined Due to Conflict",
              message,
              adminEmail // ✅ from admin
            );
          }

          const adminConflictMessage = `You approved a booking which caused the auto-decline of ${booking.name}'s booking (${booking.room}) from ${new Date(
            booking.start
          ).toLocaleString()} to ${new Date(booking.end).toLocaleString()} on floor ${booking.floor}.`;

          await sendEmail(adminEmail, "Auto-Declined Booking", adminConflictMessage, adminEmail);
        }
      } catch (error) {
        console.error("Error approving booking:", error);
        alert("An error occurred while approving the booking. Check console logs.");
      }
    })();
  };

  const removeBooking = () => {
    onClose();

    (async () => {
      try {
        const floorCollection = eventData.floor === 10 ? "bookings_floor10" : "bookings_floor7";
        await deleteDoc(doc(db, floorCollection, eventData.id));

        if (eventData.userEmail) {
          const message =
            eventData.status === "approved"
              ? `Hello ${eventData.name},\n\nYour previously approved booking for ${eventData.room} on ${new Date(
                  eventData.start
                ).toLocaleString()} has been cancelled by the admin.\n\nWe apologize for the inconvenience.`
              : `Hello ${eventData.name},\n\nUnfortunately, your booking for ${eventData.room} on ${new Date(
                  eventData.start
                ).toLocaleString()} was declined.\n\nThank you.`;

          await sendEmail(
            eventData.userEmail,
            eventData.status === "approved" ? "Your Booking Was Cancelled" : "Your Booking Request Declined",
            message,
            adminEmail // ✅ from admin
          );
        }

        const adminMsg =
          eventData.status === "approved"
            ? `You cancelled an approved booking for ${eventData.name} (${eventData.room}) on ${new Date(
                eventData.start
              ).toLocaleString()} (floor ${eventData.floor}).`
            : `You declined the pending booking for ${eventData.name} (${eventData.room}) on ${new Date(
                eventData.start
              ).toLocaleString()} (floor ${eventData.floor}).`;

        await sendEmail(adminEmail, "Booking Removed", adminMsg, adminEmail);
      } catch (error) {
        console.error("Error removing booking:", error);
        alert("An error occurred while declining the booking. Check console logs.");
      }
    })();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Booking Details</h3>
        <p><strong>Name:</strong> {eventData.name}</p>
        <p><strong>Department:</strong> {eventData.department}</p>
        <p><strong>Room:</strong> {eventData.room || 'Not specified'}</p>
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
