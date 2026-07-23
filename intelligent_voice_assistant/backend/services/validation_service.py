from config import MIN_MARKS, MAX_MARKS, SUBJECTS


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

    if not (MIN_MARKS <= data["marks"] <= MAX_MARKS):
        return False, f"Marks must be between {MIN_MARKS} and {MAX_MARKS}."

    return True, "Validation Successful."