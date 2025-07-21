import React, { useState, useEffect } from 'react';
import './BookingForm.css';

function BookingForm({ slot, events, onClose, onSubmit, lastUsedData }) {
  const [formData, setFormData] = useState({
    name: '',
    cpr: '',
    phone: '',
    department: ''
  });
  const [duration, setDuration] = useState(60);
  const [hasConflict, setHasConflict] = useState(false);
  const [calculatedEnd, setCalculatedEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill from lastUsedData but allow edits except name
  useEffect(() => {
  if (lastUsedData) {
    setFormData(prev => ({
      ...prev,
      ...lastUsedData,
      // Keep current department if user started typing
      department: prev.department || lastUsedData.department || ''
    }));
  }
}, [lastUsedData]);


  useEffect(() => {
    if (!slot || !slot.start || !slot.end) return;

    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const diffMs = end - start;
    const diffMins = Math.round(diffMs / 60000);
    const defaultDuration = Math.min(diffMins, 300);

    setDuration(defaultDuration);
    updateCalculatedEnd(defaultDuration);
  }, [slot]);

  useEffect(() => {
    updateCalculatedEnd(duration);
  }, [duration]);

  const updateCalculatedEnd = (durationMinutes) => {
    if (!slot || !slot.start) return;

    const start = new Date(slot.start);
    if (isNaN(start.getTime())) return;

    const newEnd = new Date(start.getTime() + durationMinutes * 60000);
    setCalculatedEnd(newEnd.toISOString());

    // Check if an approved booking exists
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

    // Count pending bookings that overlap
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
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasConflict || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ ...formData, room: slot.resourceId }, calculatedEnd);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!slot || !slot.start) return null;

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

          <label>CPR:</label>
          <input
            type="text"
            name="cpr"
            placeholder="Enter CPR Number"
            value={formData.cpr}
            onChange={handleChange}
            required
          />

          <label>Phone Number:</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 8);
              setFormData(prev => ({ ...prev, phone: value }));
            }}
            maxLength={8}
            pattern="\d{8}"
title="Please enter an 8-digit phone number"
            required
          />

          <input
  type="text"
  name="department"
  value={formData.department}
  onChange={handleChange}
  placeholder="Enter Department"
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
