import datetime
import asyncio
from sqlalchemy.orm import Session
from backend.app.services.database import SessionLocal
from backend.app.models.health import FollowUpAppointment, Notification

async def process_appointment_reminders():
    """
    Background worker that runs periodically to inspect scheduled appointments
    and generate persistent reminder notifications.
    """
    while True:
        try:
            db: Session = SessionLocal()
            now = datetime.datetime.now(datetime.timezone.utc)
            
            # Fetch upcoming scheduled appointments where reminder not yet sent
            upcoming_appointments = db.query(FollowUpAppointment).filter(
                FollowUpAppointment.status == "Scheduled",
                FollowUpAppointment.is_reminder_sent == False
            ).all()

            for appt in upcoming_appointments:
                # Ensure appointment_date has timezone
                appt_time = appt.appointment_date
                if appt_time.tzinfo is None:
                    appt_time = appt_time.replace(tzinfo=datetime.timezone.utc)

                time_diff = appt_time - now
                hours_remaining = time_diff.total_seconds() / 3600.0

                # Check if within user's reminder window (e.g. 24 hours) or due today
                if 0 <= hours_remaining <= appt.reminder_advance_hours:
                    formatted_time = appt_time.strftime("%A, %b %d at %I:%M %p")
                    note = Notification(
                        user_id=appt.user_id,
                        title="Upcoming Follow-up Appointment Reminder",
                        message=f"Reminder: You have a scheduled dermatologist consultation with {appt.doctor_or_clinic} on {formatted_time}.",
                        notification_type="AppointmentReminder",
                        urgency="Normal",
                        reference_id=appt.id,
                        reference_type="appointment"
                    )
                    db.add(note)
                    appt.is_reminder_sent = True
                    db.commit()

                # Check if overdue
                elif hours_remaining < -2.0 and appt.status == "Scheduled":
                    # Mark appointment reminder overdue
                    note = Notification(
                        user_id=appt.user_id,
                        title="Follow-up Appointment Status Check",
                        message=f"Your appointment with {appt.doctor_or_clinic} was scheduled for {appt_time.strftime('%b %d')}. Please update its status or reschedule if needed.",
                        notification_type="AppointmentReminder",
                        urgency="Normal",
                        reference_id=appt.id,
                        reference_type="appointment"
                    )
                    db.add(note)
                    appt.is_reminder_sent = True
                    db.commit()

            db.close()
        except Exception as e:
            print(f"[Appointment Scheduler Error] {e}")

        # Sleep for 60 seconds before next check
        await asyncio.sleep(60)

