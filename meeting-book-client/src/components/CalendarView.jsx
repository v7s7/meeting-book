import React from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import BookingActionModal from './BookingActionModal';
import './CalendarView.css';

function CalendarView({ events, onSelectSlot, isAdmin, currentUser }) {
  const [selectedEvent, setSelectedEvent] = React.useState(null);

  const handleEventClick = (info) => {
    if (isAdmin) {
      const eventData = events.find((e) => e.id === info.event.id);
      setSelectedEvent(eventData);
    } else {
      alert("You can only delete your own bookings.");
    }
  };

  const renderEventContent = (arg) => {
    const { status } = arg.event.extendedProps;
    const isApproved = status === "approved";
    return (
      <div className="event-container">
        <div className={`event-content ${isApproved ? "approved" : "pending"}`}>
          {arg.event.title} {!isApproved && "(Pending)"}
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-wrapper">
      <div className="calendar-scroll">
        <div className="calendar-page">
          <div className="calendar-header">
            <div id="calendar-toolbar" />
            {currentUser && (
              <div className="user-info">
                Logged in as: <strong>{currentUser.name}</strong>
              </div>
            )}
          </div>
          <div className="calendar-container">
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
              initialView="resourceTimeGridDay"
              schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
              slotMinTime="08:00:00"
              slotMaxTime="18:00:00"
              longPressDelay={100}
              selectMinDistance={1}
              selectAllow={() => true}
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
                resourceId: event.room || 'Room 1',
              }))}
              eventContent={renderEventContent}
              select={(info) => {
                onSelectSlot({
                  start: info.startStr,
                  end: info.endStr,
                  resourceId: info.resource?.id || 'Room 1',
                });
              }}
              eventClick={handleEventClick}
            />
          </div>
        </div>
      </div>

      {isAdmin && selectedEvent && (
        <BookingActionModal
          eventData={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          events={events}
        />
      )}
    </div>
  );
}

export default CalendarView;
