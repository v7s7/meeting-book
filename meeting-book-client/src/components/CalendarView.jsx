import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import { getAuth } from 'firebase/auth';
import './CalendarView.css';

function CalendarView({ events, onSelectSlot, onDeleteEvent, isAdmin }) {
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;
  const [selectedSlot, setSelectedSlot] = useState(null);

  const handleSlotSelect = (info) => {
    const slot = {
      start: info.start,
      end: info.end,
      resourceId: info.resource?.id || '',
    };
    setSelectedSlot(slot);
    if (onSelectSlot) onSelectSlot(slot);
  };

  const handleEventClick = (info) => {
    const eventUserId = info.event.extendedProps.userId;
    const isOwner = eventUserId === currentUserId;

    if (isOwner || isAdmin) {
      const room = info.event.extendedProps.room || info.event.getResources?.()[0]?.id || 'this room';
      const time = new Date(info.event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const confirmed = window.confirm(
        `Delete this booking at ${time} in ${room}?`
      );

      if (confirmed) {
        onDeleteEvent(info.event.id);
      }
    }
  };

  return (
    <div className="calendar-wrapper" style={{ width: '100%' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="calendar-page">
          <div className="calendar-header">
            <div id="calendar-toolbar" />
          </div>
          <div className="calendar-container">
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
              initialView="resourceTimeGridDay"
              selectable={true}
              selectMirror={true}
              editable={false}
              allDaySlot={false}
              slotMinTime="08:00:00"
              slotMaxTime="18:00:00"
              slotDuration="00:30:00"  
              height="auto"
              events={events}
              eventClick={handleEventClick}
              select={handleSlotSelect}  
              resources={[
                { id: 'room1', title: 'Room 1' },
                { id: 'room2', title: 'Room 2' },
                { id: 'room3', title: 'Room 3' },
              ]}
              resourceAreaHeaderContent="Rooms"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
