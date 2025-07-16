import React from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getAuth } from 'firebase/auth';
import './CalendarView.css';

function CalendarView({ events, onSelectSlot, onDeleteEvent, isAdmin }) {
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;

 const handleEventClick = (info) => {
  const eventUserId = info.event.extendedProps.userId;
  const isOwner = eventUserId === currentUserId;

  if (!isOwner && !isAdmin) return; // ✅ allow if admin OR owner

  const confirmDelete = window.confirm('Do you want to delete this booking?');
 onDeleteEvent(info.event.id);
};


  return (
    <div className="calendar-wrapper">
        <div className="calendar-page">

      <div className="calendar-header">
        <div id="calendar-toolbar" />
      </div>
      <div className="calendar-container">
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          slotMinTime="08:00:00"
          slotMaxTime="18:00:00"
          allDaySlot={false}
          selectable={true}
          selectMirror={true}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''
          }}
          events={events}
          select={onSelectSlot}
          eventClick={handleEventClick}
          height="61vh"
        />
      </div>
      </div>
    </div>
  );
}

export default CalendarView;
