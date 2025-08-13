import React from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import './CalendarView.css';
import enGb from '@fullcalendar/core/locales/en-gb';

function CalendarView({ events, onSelectSlot, isAdmin, currentUser, setSelectedEvent, selectedFloor }) {

  const handleEventClick = (info) => {
    if (!isAdmin) return;
    const eventData = events.find((e) => e.id === info.event.id);
    setSelectedEvent(eventData);
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
              </div>
            )}
          </div>
          <div className="calendar-container">
<FullCalendar
  plugins={[timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
  locales={[enGb]}
  locale="en-gb"
  initialView="resourceTimeGridDay"
  schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
  slotMinTime="08:00:00"
  slotMaxTime="18:00:00"
  longPressDelay={100}
  selectMinDistance={1}
  allDaySlot={false}
  selectable={true}
  selectMirror={true}
  resourceAreaHeaderContent="Rooms"
  height="61vh"

  /* Force: Wednesday, 13 August 2025 (with comma after weekday) */
  titleFormat={(arg) => {
    const d = arg.date.marker; // native Date
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
    return `${weekday}, ${day} ${month} ${year}`;
  }}

  /* Keep 12-hour clock */
  slotLabelFormat={{
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }}
  eventTimeFormat={{
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }}

  selectAllow={(selectInfo) => {
    return new Date(selectInfo.start) > new Date();
  }}

  headerToolbar={{
    left: 'prev,next today',
    center: 'title',
    right: ''
  }}

  resources={
    selectedFloor === 10
      ? [
          { id: 'Room1', title: 'Room 1 ( Big Room )' },
          { id: 'Room2', title: 'Room 2 ( Mid Room )' },
          { id: 'Room3', title: 'Room 3 ( Small Room NO TV )' }
        ]
      : [
          { id: 'Room1', title: 'Meeting Room (Masaajid)' },
          { id: 'Room2', title: 'Training Room' }
        ]
  }

  events={events.map(event => ({
    ...event,
    resourceId: event.room,
    floor: selectedFloor
  }))}

  eventContent={renderEventContent}

  select={(info) => {
    onSelectSlot({
      start: info.startStr,
      end: info.endStr,
      resourceId: info.resource?.id || null
    });
  }}

  eventClick={handleEventClick}
/>


          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
