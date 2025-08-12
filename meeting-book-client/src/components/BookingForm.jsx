import React, { useState, useEffect } from 'react';
import './BookingForm.css';

function BookingForm({ slot, events, onClose, onSubmit, loggedInUser }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    customDepartment: '',
    purpose: '',       // NEW
    attendees: ''      // NEW
  });

  const [duration, setDuration] = useState(60);
  const [hasConflict, setHasConflict] = useState(false);
  const [calculatedEnd, setCalculatedEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtherSelected, setIsOtherSelected] = useState(false);

  useEffect(() => {
    if (loggedInUser) {
      setFormData({
        name: loggedInUser.name || '',
        email: loggedInUser.email || loggedInUser.username || '',
        department: loggedInUser.department || '',
        customDepartment: loggedInUser.customDepartment || '',
        purpose: '',
        attendees: ''
      });
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync isOtherSelected based on loaded department
  useEffect(() => {
    setIsOtherSelected(formData.department === 'Other');
  }, [formData.department]);

  useEffect(() => {
    if (!slot?.start || !slot?.end) return;
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (isNaN(start) || isNaN(end)) return;
    const diffMins = Math.round((end - start) / 60000);
    const defaultDuration = Math.min(diffMins, 300);
    setDuration(defaultDuration);
    updateCalculatedEnd(defaultDuration);
  }, [slot]);

  useEffect(() => {
    updateCalculatedEnd(duration);
  }, [duration]);

  const updateCalculatedEnd = (durationMinutes) => {
    if (!slot?.start) return;
    const start = new Date(slot.start);
    const newEnd = new Date(start.getTime() + durationMinutes * 60000);
    setCalculatedEnd(newEnd.toISOString());

    const hasApprovedConflict = events.some(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return (
        start < evEnd &&
        newEnd > evStart &&
        ev.room === slot.resourceId &&
        ev.status === "approved"
      );
    });

    const pendingCount = events.filter(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return (
        start < evEnd &&
        newEnd > evStart &&
        ev.room === slot.resourceId &&
        ev.status === "pending"
      );
    }).length;

    if (pendingCount >= 4) {
      alert("This slot already has 4 pending bookings. Please contact the Admin.");
    }

    setHasConflict(hasApprovedConflict || pendingCount >= 4);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasConflict || isSubmitting) return;

    // Basic validation for new fields
    if (!formData.purpose || formData.purpose.trim().length < 3) {
      alert("Please enter a short purpose for the meeting (min 3 characters).");
      return;
    }
    const n = Number(formData.attendees);
    if (!Number.isInteger(n) || n <= 0) {
      alert("Please enter the expected number of people (a positive integer).");
      return;
    }

    setIsSubmitting(true);
    onClose();

    const isCustom = formData.department === "Other";

    onSubmit(
      {
        ...formData,
        department: isCustom ? "Other" : formData.department,
        customDepartment: isCustom ? formData.customDepartment : "",
        attendees: Number(formData.attendees), // ensure numeric
        room: slot.resourceId
      },
      calculatedEnd
    )
      .catch(err => console.error("Booking failed:", err))
      .finally(() => setIsSubmitting(false));
  };

  if (!slot?.start) return null;

  const departmentOptions = [
    "HR", "Finance", "IT", "Operations", "Admin", "Marketing", "Other"
  ];

  return (
    <div className="overlay">
      <div className="form-container">
        <button className="close-btn" onClick={onClose}>×</button>
        <form onSubmit={handleSubmit}>
          <h3>Book Time Slot</h3>

          <p><strong>Room:</strong> {slot.resourceId || 'Unspecified'}</p>
          <p><strong>Start:</strong> {new Date(slot.start).toLocaleString()}</p>
          <p><strong>End:</strong> {calculatedEnd ? new Date(calculatedEnd).toLocaleString() : '—'}</p>

          <label>Duration:</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[...Array(10)].map((_, i) => {
              const minutes = 30 + i * 30;
              return (
                <option key={minutes} value={minutes}>
                  {minutes % 60 === 0
                    ? `${minutes / 60} hour${minutes > 60 ? 's' : ''}`
                    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
                </option>
              );
            })}
          </select>

          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            readOnly
            style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
          />

          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            readOnly
            style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
          />

          <label>Department:</label>
          <select
            name="department"
            value={formData.department}
            onChange={handleChange}
            required
          >
            <option value="" disabled hidden>
              {formData.department === "Other" && formData.customDepartment
                ? "Other"
                : "Select Department"}
            </option>
            {departmentOptions.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {isOtherSelected && (
            <>
              <label>Enter Department:</label>
              <input
                type="text"
                name="customDepartment"
                value={formData.customDepartment || ""}
                onChange={handleChange}
                required
              />
            </>
          )}

          {/* NEW FIELDS */}
          <label>Purpose of Meeting:</label>
          <textarea
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            required
          />

          <label>Expected Number of People:</label>
          <input
            type="number"
            name="attendees"
            min="1"
            step="1"
            value={formData.attendees}
            onChange={handleChange}
            required
          />

          {hasConflict && <p className="conflict">This slot is already booked in this room.</p>}

          <div className="form-actions">
            <button type="submit" disabled={hasConflict || isSubmitting}>
              {isSubmitting ? 'Booking…' : 'Confirm'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingForm;
