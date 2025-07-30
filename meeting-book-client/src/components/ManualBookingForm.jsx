import React, { useState } from 'react';
import './BookingForm.css'; // Reuse existing styles

function ManualBookingForm({ onClose, onSubmit, selectedFloor }) {
  const [room, setRoom] = useState('Room 1');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30); // Default 30 mins

const handleSubmit = (e) => {
  e.preventDefault();
  if (!date || !time) return;

  const start = new Date(`${date}T${time}`);
  
  // ✅ Prevent booking in the past
  if (start < new Date()) {
    alert("You cannot book a time in the past.");
    return;
  }

  const end = new Date(start.getTime() + duration * 60000);

  onSubmit({
    start: start.toISOString(),
    end: end.toISOString(),
    resourceId: room
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
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />

          <label>Room:</label>
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
  {selectedFloor === 10 ? (
    <>
      <option value="Room 1">Room 1</option>
      <option value="Room 2">Room 2</option>
      <option value="Room 3">Room 3</option>
    </>
  ) : (
    <>
      <option value="Room 1">Room 1</option>
      <option value="Room 2">Room 2</option>
    </>
  )}
</select>


          <label>Duration (minutes):</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[30, 60, 90, 120].map(min => (
              <option key={min} value={min}>{min} minutes</option>
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
