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

        const displayDept =
          eventData.department === "Other"
            ? eventData.customDepartment || "Other"
            : eventData.department;

        const purposeLine = `Purpose: ${eventData.purpose || "-"}`;
        const attendeesLine = `Attendees: ${eventData.attendees ?? "-"}`;

        if (eventData.userEmail) {
          const userMessage = `Dear ${eventData.name},

Your reservation for ${eventData.room} from ${new Date(eventData.start).toLocaleString()} to ${new Date(eventData.end).toLocaleString()} has been successfully approved.


Best regards,
SWD Booking Team`;

          const result = await sendEmail(
            eventData.userEmail,
            "Your Booking is Approved",
            userMessage,
            adminEmail
          );
          if (!result.success) {
            console.error("Failed to send user approval email:", result.error);
            alert("Booking approved, but the email notification to the user failed.");
          }

          const adminMessage = `You approved the booking:

Name: ${eventData.name}
Email: ${eventData.userEmail}
Room: ${eventData.room}
Floor: ${eventData.floor}
Start: ${new Date(eventData.start).toLocaleString()}
End: ${new Date(eventData.end).toLocaleString()}
Department: ${displayDept}
${purposeLine}
${attendeesLine}`;

          await sendEmail(adminEmail, "You Approved a Booking", adminMessage, adminEmail);
        }

        // Auto-decline overlapping pending bookings
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

          const bPurpose = `Purpose: ${booking.purpose || "-"}`;
          const bAttendees = `Attendees: ${booking.attendees ?? "-"}`;

          if (booking.userEmail) {
            const message = `Hello ${booking.name},

Your booking for ${booking.room} on ${new Date(booking.start).toLocaleString()} was automatically declined because another booking was approved for that time.

Thank you.`;

            await sendEmail(
              booking.userEmail,
              "Booking Request Declined Due to Conflict",
              message,
              adminEmail
            );
          }

          const adminConflictMessage = `Auto-declined a conflicting booking after approval:

Declined Name: ${booking.name}
Email: ${booking.userEmail || "-"}
Room: ${booking.room}
Floor: ${booking.floor}
Start: ${new Date(booking.start).toLocaleString()}
End: ${new Date(booking.end).toLocaleString()}
${bPurpose}
${bAttendees}`;

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

        const purposeLine = `Purpose: ${eventData.purpose || "-"}`;
        const attendeesLine = `Attendees: ${eventData.attendees ?? "-"}`;

        if (eventData.userEmail) {
          const message =
            eventData.status === "approved"
              ? `Hello ${eventData.name},

Your previously approved booking for ${eventData.room} on ${new Date(eventData.start).toLocaleString()} has been cancelled by the admin.



We apologize for the inconvenience.`
              : `Hello ${eventData.name},

Unfortunately, your booking for ${eventData.room} on ${new Date(eventData.start).toLocaleString()} was declined.

Thank you.`;

          await sendEmail(
            eventData.userEmail,
            eventData.status === "approved" ? "Your Booking Was Cancelled" : "Your Booking Request Declined",
            message,
            adminEmail
          );
        }

        const adminMsg =
          eventData.status === "approved"
            ? `You cancelled an approved booking:

Name: ${eventData.name}
Email: ${eventData.userEmail || "-"}
Room: ${eventData.room}
Floor: ${eventData.floor}
Start: ${new Date(eventData.start).toLocaleString()}
End: ${new Date(eventData.end).toLocaleString()}
${purposeLine}
${attendeesLine}`
            : `You declined a pending booking:

Name: ${eventData.name}
Email: ${eventData.userEmail || "-"}
Room: ${eventData.room}
Floor: ${eventData.floor}
Start: ${new Date(eventData.start).toLocaleString()}
End: ${new Date(eventData.end).toLocaleString()}
${purposeLine}
${attendeesLine}`;

        await sendEmail(adminEmail, "Booking Removed", adminMsg, adminEmail);
      } catch (error) {
        console.error("Error removing booking:", error);
        alert("An error occurred while declining the booking. Check console logs.");
      }
    })();
  };

  const displayDept =
    eventData.department === "Other"
      ? eventData.customDepartment || "Other"
      : eventData.department;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Booking Details</h3>
        <p><strong>Name:</strong> {eventData.name}</p>
        <p><strong>Department:</strong> {displayDept}</p>
        <p><strong>Room:</strong> {eventData.room || 'Not specified'}</p>
        <p><strong>Start:</strong> {new Date(eventData.start).toLocaleString()}</p>
        <p><strong>End:</strong> {new Date(eventData.end).toLocaleString()}</p>
        {/* Show the new fields in the admin modal */}
        <p><strong>Purpose:</strong> {eventData.purpose || '—'}</p>
        <p><strong>Attendees:</strong> {eventData.attendees ?? '—'}</p>

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
