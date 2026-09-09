try:
    from backend.config import MARKS_LIMITS, SUBJECTS
    from backend.services.session_service import get_current_column
except ModuleNotFoundError:  # pragma: no cover
    from config import MARKS_LIMITS, SUBJECTS
    from services.session_service import get_current_column


def validate_data(data: dict):
    """
    Validate parsed voice command.
    """

    # Roll Number
    if not data["roll_no"]:
        return False, "Invalid or missing Roll Number."

    # Subject
    if not data["subject"]:
        return False, "Subject not recognized."

    if data["subject"].upper() not in [s.upper() for s in SUBJECTS]:
        return False, "Invalid Subject."

    # Marks
    if data["marks"] is None:
        return False, "Marks not found."

    current_column = get_current_column()
    limits = MARKS_LIMITS.get(current_column)
    if limits is not None:
        minimum, maximum = limits
        if not minimum <= data["marks"] <= maximum:
            return False, f"{current_column.title()} marks must be between {minimum} and {maximum}."

    return True, "Validation Successful."