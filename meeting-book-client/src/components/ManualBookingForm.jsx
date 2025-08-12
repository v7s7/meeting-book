import React, { useState } from 'react';
import './BookingForm.css';

function ManualBookingForm({ onClose, onSubmit, selectedFloor }) {
  const [room, setRoom] = useState('Room1');  // ✅ use resource ID (no space)
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);

  const DURATIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !time) return;

    // Enforce start time: 08:00 ≤ start < 17:00
    const [hh, mm] = time.split(':');
    const hour = Number(hh);
    const minute = Number(mm || 0);
    if (Number.isNaN(hour) || hour < 8 || hour >= 18) {
      alert("Start time must be between 08:00 and 17:00 (5 PM).");
      return;
    }

    const start = new Date(`${date}T${time}`);
    if (start < new Date()) {
      alert("You cannot book a time in the past.");
      return;
    }

    const end = new Date(start.getTime() + duration * 60000);

    onSubmit({
      start: start.toISOString(),
      end: end.toISOString(),
      resourceId: room,   // ✅ matches CalendarView resource IDs
    });

    onClose();
  };

  return (
    <div className="overlay">
      <div className="form-container">
        <button className="close-btn" onClick={onClose}>×</button>
        <form onSubmit={handleSubmit}>
          <h3>Manual Booking</h3>

          <label>Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            required
          />

          <label>Start Time:</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            min="08:00"
            max="17:00"
            required
          />

          <label>Room:</label>
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            {selectedFloor === 10 ? (
              <>
                <option value="Room1">Room 1 ( Big Room )</option>
                <option value="Room2">Room 2 ( Mid Room )</option>
                <option value="Room3">Room 3 ( Small Room NO TV )</option>
              </>
            ) : (
              <>
                <option value="Room1">Meeting Room</option>
                <option value="Room2">Training Room</option>
              </>
            )}
          </select>

          <label>Duration:</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((min) => (
              <option key={min} value={min}>
                {min % 60 === 0
                  ? `${min / 60} hour${min > 60 ? 's' : ''}`
                  : `${Math.floor(min / 60)}h ${min % 60}m`}
              </option>
            ))}
          </select>

          <div className="form-actions">
            <button type="submit">Continue</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ManualBookingForm;
