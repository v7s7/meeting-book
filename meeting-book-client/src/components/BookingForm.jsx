import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import './BookingForm.css';

function BookingForm({ slot, events, onClose, onSubmit }) {
  const auth = getAuth();
  const [formData, setFormData] = useState({ name: '', email: '', purpose: '' });
  const [duration, setDuration] = useState(60);
  const [hasConflict, setHasConflict] = useState(false);
  const [calculatedEnd, setCalculatedEnd] = useState('');

  useEffect(() => {
    if (!slot || !slot.start || !slot.end) return;

    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const diffMs = end - start;
    const diffMins = Math.round(diffMs / 60000);
    const defaultDuration = Math.min(diffMins, 300); // max 5 hours

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

    const conflict = events.some(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return (
        start < evEnd &&
        newEnd > evStart &&
        ev.room === slot.resourceId
      );
    });

    setHasConflict(conflict);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasConflict) {
      alert('This time slot is already booked in this room.');
      return;
    }

    onSubmit({ ...formData, room: slot.resourceId }, calculatedEnd);
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

          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="purpose"
            placeholder="Purpose"
            value={formData.purpose}
            onChange={handleChange}
            required
          />

          {hasConflict && <p className="conflict">This slot is already booked in this room.</p>}

          <div className="form-actions">
            <button type="submit" disabled={hasConflict}>Confirm</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingForm;
