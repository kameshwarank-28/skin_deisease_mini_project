from typing import List, Optional
from sqlalchemy.orm import Session
from backend.app.models.health import SymptomRecord, Notification

SEVERITY_SCORES = {
    "mild": 1,
    "moderate": 2,
    "severe": 3
}

URGENT_SYMPTOMS = {"severe pain", "rapid swelling", "blistering with fever", "bleeding lesion", "severe burning"}

def check_symptom_progression_and_alert(
    db: Session,
    user_id: int,
    new_symptom: SymptomRecord
) -> Optional[dict]:
    """
    Evaluates new user-reported symptom against historical symptoms.
    If worsening severity or urgent warning signs are identified,
    creates an in-app safety notification and returns advisory metadata.
    """
    symptom_name_lower = new_symptom.symptom_name.strip().lower()
    current_score = SEVERITY_SCORES.get(new_symptom.severity.lower(), 1)

    # Fetch previous records for the same symptom for this user
    previous_entries = db.query(SymptomRecord).filter(
        SymptomRecord.user_id == user_id,
        SymptomRecord.id != new_symptom.id,
        SymptomRecord.symptom_name.ilike(new_symptom.symptom_name.strip())
    ).order_by(SymptomRecord.recorded_at.desc()).limit(3).all()

    alert_triggered = False
    alert_title = ""
    alert_message = ""
    urgency_level = "Normal"

    # Case 1: Severe symptom reported
    if current_score == 3 or any(k in symptom_name_lower for k in ["severe", "bleeding", "infected", "pus"]):
        alert_triggered = True
        urgency_level = "Urgent"
        alert_title = "Important Health Advisory: Severe Symptom Logged"
        alert_message = (
            f"You reported severe {new_symptom.symptom_name}. "
            "New warning signs have been reported. Please contact your treating dermatologist promptly for professional guidance. "
            "If you experience rapid swelling, severe pain, spreading redness accompanied by fever, or difficulty breathing, "
            "please seek emergency medical care immediately."
        )

    # Case 2: Worsening from previous entry
    elif previous_entries:
        last_score = previous_entries[0].severity_score
        if current_score > last_score:
            alert_triggered = True
            urgency_level = "Warning"
            alert_title = "Symptom Change Alert: Reassessment Recommended"
            alert_message = (
                f"Your latest entry for '{new_symptom.symptom_name}' indicates an increase from {previous_entries[0].severity} to {new_symptom.severity}. "
                "Your latest symptom entry indicates a change compared with your previous record. "
                "Consider contacting your treating dermatologist for reassessment. "
                "Please do not alter, stop, or adjust your prescribed treatments without medical advice."
            )

    if alert_triggered:
        # Create persistent in-app notification
        notification = Notification(
            user_id=user_id,
            title=alert_title,
            message=alert_message,
            notification_type="WorseningAlert",
            urgency=urgency_level,
            reference_id=new_symptom.id,
            reference_type="symptom"
        )
        db.add(notification)
        db.commit()

        return {
            "alert_triggered": True,
            "urgency": urgency_level,
            "title": alert_title,
            "message": alert_message,
            "safety_guideline": (
                "Notice: This platform does not provide medical diagnoses or alter prescriptions. "
                "All medical decisions and treatment adjustments must be evaluated by a certified clinician."
            )
        }

    return None

