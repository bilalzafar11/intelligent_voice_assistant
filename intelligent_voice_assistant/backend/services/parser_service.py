import re
from services.session_service import clear_current_column, set_current_column


VALID_COLUMNS = [
    "assignment",
    "test",
    "midterm",
    "final",
    "finalterm"
]

COLUMN_ALIASES = {
    "assignment": ["assignment", "assign", "assignment column"],
    "test": ["test", "quiz", "quizzes"],
    "midterm": ["midterm", "mid"],
    "final": ["final", "finalterm", "finals"],
    "finalterm": ["final", "finalterm", "finals"]
}

SELECTION_KEYWORDS = ["lock", "select", "set", "choose", "column", "subject"]
UNLOCK_KEYWORDS = ["exit", "unlock", "clear", "release", "cancel"]


def find_column(text: str):
    for column, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if re.search(fr"\b{alias}\b", text):
                return column
    return None


def parse_voice_command(text: str):

    text = text.lower().strip()

    if re.search(fr"\b({'|'.join(UNLOCK_KEYWORDS)})\b", text):
        clear_current_column()
        return {
            "type": "unlock"
        }

    column = find_column(text)
    has_selection_word = bool(re.search(fr"\b({'|'.join(SELECTION_KEYWORDS)})\b", text))

    # -----------------------------
    # Marks Entry Command
    # Example:
    # 2 ka 3
    # 10 ka 18
    # roll no 1 marks 5
    # 1 marks 5
    # assignment roll number 1 marks 85
    # -----------------------------

    patterns = [
        r"roll\s*(?:no\.?|number)?\s*(\d+)\s*(?:marks?|ka)\s*(\d+)",
        r"(\d+)\s*ka\s*(\d+)",
        r"(\d+)\s*marks?\s*(\d+)"
    ]

    marks_match = None
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            marks_match = match
            break

    if column and has_selection_word:
        set_current_column(column)
        return {
            "type": "column",
            "column": column
        }

    if marks_match:
        if column:
            set_current_column(column)
            return {
                "type": "marks",
                "roll_no": int(marks_match.group(1)),
                "marks": int(marks_match.group(2)),
                "column": column
            }

        return {
            "type": "marks",
            "roll_no": int(marks_match.group(1)),
            "marks": int(marks_match.group(2))
        }

    if column:
        set_current_column(column)
        return {
            "type": "column",
            "column": column
        }

    return {
        "type": "unknown"
    }
