import React from "react";
import { updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../utils/firebase";
import "./BookingActionModal.css";

function BookingActionModal({ eventData, onClose, events }) {
  if (!eventData) return null;

  const approveBooking = async () => {
    await updateDoc(doc(db, "bookings", eventData.id), { status: "approved" });

    // Remove overlapping pending bookings
    const overlappingPending = events.filter(e =>
      e.id !== eventData.id &&
      e.status === "pending" &&
      e.room === eventData.room &&
      new Date(e.start) < new Date(eventData.end) &&
      new Date(e.end) > new Date(eventData.start)
    );
    for (const booking of overlappingPending) {
      await deleteDoc(doc(db, "bookings", booking.id));
    }
    onClose();
  };

  const removeBooking = async () => {
    await deleteDoc(doc(db, "bookings", eventData.id));
    onClose();
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
          {eventData.status === "pending" && (
            <button onClick={approveBooking}>Approve</button>
          )}
          <button onClick={removeBooking}>Remove</button>
          <button className="btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default BookingActionModal;
