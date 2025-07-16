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
  const diffMs = end - start;
  const diffMins = Math.round(diffMs / 60000);
  
  const defaultDuration = Math.min(diffMins, 300); // ✅ Up to 5 hours
  setDuration(defaultDuration);

  updateCalculatedEnd(defaultDuration);
}, [slot]);


  useEffect(() => {
    updateCalculatedEnd(duration);
  }, [duration]);

  const updateCalculatedEnd = (durationMinutes) => {
  if (!slot || !slot.start) return;

  const start = new Date(slot.start);
  const newEnd = new Date(start.getTime() + durationMinutes * 60000);
  setCalculatedEnd(newEnd.toISOString());

  const conflict = events.some(ev => {
    const evStart = new Date(ev.start);
    const evEnd = new Date(ev.end);
    return start < evEnd && newEnd > evStart;
  });

  setHasConflict(conflict);
};


  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasConflict) {
      alert('Time slot is already booked.');
      return;
    }
    onSubmit(formData, calculatedEnd);
  };

  if (!slot) return null;

  return (
    <div className="overlay">
      <div className="form-container">
        <button className="close-btn" onClick={onClose}>×</button>
        <form onSubmit={handleSubmit}>
          <h3>Book Time Slot</h3>
          <p><strong>Start:</strong> {new Date(slot.start).toLocaleString()}</p>
<p><strong>End:</strong> {calculatedEnd ? new Date(calculatedEnd).toLocaleString() : '—'}</p>
          <label>Duration:</label>
<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
  <option value={30}>30 minutes</option>
  <option value={60}>1 hour</option>
  <option value={90}>1.5 hours</option>
  <option value={120}>2 hours</option>
  <option value={150}>2.5 hours</option>
  <option value={180}>3 hours</option>
  <option value={210}>3.5 hours</option>
  <option value={240}>4 hours</option>
  <option value={270}>4.5 hours</option>
  <option value={300}>5 hours</option>
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
          {hasConflict && <p className="conflict">This slot is already booked.</p>}
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
