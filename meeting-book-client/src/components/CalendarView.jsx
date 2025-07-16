import React from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import { getAuth } from 'firebase/auth';
import './CalendarView.css';

function CalendarView({ events, onSelectSlot, onDeleteEvent, isAdmin }) {
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;

 const handleEventClick = (info) => {
  const eventUserId = info.event.extendedProps.userId;
  const isOwner = eventUserId === currentUserId;

  if (isOwner || isAdmin) {
    const confirmed = window.confirm(
      `Delete booking for "${info.event.title}" in ${info.event.extendedProps.room}?`
    );
    if (confirmed) {
      onDeleteEvent(info.event.id);
    }
  }
};


  return (
    <div className="calendar-wrapper">
      <div className="calendar-page">
        <div className="calendar-header">
          <div id="calendar-toolbar" />
        </div>
        <div className="calendar-container">
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
            initialView="resourceTimeGridDay"
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            slotMinTime="08:00:00"
            slotMaxTime="18:00:00"
            allDaySlot={false}
            selectable={true}
            selectMirror={true}
            height="61vh"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            resources={[
              { id: 'Room 1', title: 'Room 1' },
              { id: 'Room 2', title: 'Room 2' },
              { id: 'Room 3', title: 'Room 3' }
            ]}
            events={events.map(event => ({
              ...event,
              resourceId: event.room || 'Room 1'  // Default to Room A if not specified
            }))}
            select={(info) => {
  console.log("SELECT FIRED:", info);
  console.log("Resource:", info.resource?.id);
  onSelectSlot({
    start: info.startStr,
    end: info.endStr,
    resourceId: info.resource?.id || 'Room 1',  // fallback
  });
}}
            eventClick={handleEventClick}
          />
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
