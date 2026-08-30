import re

try:
    from backend.services.session_service import clear_current_column, get_current_column, set_current_column
except ModuleNotFoundError:  # pragma: no cover
    from services.session_service import clear_current_column, get_current_column, set_current_column


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
UNLOCK_KEYWORDS = ["exit", "unlock", "clear", "release", "cancel", "stop"]
NUMBER_WORDS = {
    "zero": "0", "nill": "0", "o": "0",
    "ek": "1", "ak": "1", "one": "1", "1": "1",
    "do": "2", "two": "2", "2": "2",
    "teen": "3", "three": "3", "3": "3",
    "char": "4", "chaar": "4", "four": "4", "4": "4",
    "panch": "5", "five": "5", "5": "5",
    "cheh": "6", "six": "6", "6": "6",
    "saat": "7", "seven": "7", "7": "7",
    "ath": "8", "eight": "8", "8": "8",
    "nau": "9", "nine": "9", "9": "9",
    "das": "10", "ten": "10", "10": "10",
    "twenty": "20", "thirty": "30", "forty": "40", "fifty": "50",
    "sixty": "60", "seventy": "70", "eighty": "80", "ninety": "90",
    "hundred": "100"
}

COMMON_SPELLING_FIXES = {
    "midetem": "midterm",
    "mideterm": "midterm",
    "midtem": "midterm",
    "midtrem": "midterm",
    "midtermm": "midterm",
    "middterm": "midterm",
    "assigment": "assignment",
    "asignment": "assignment",
    "assgnment": "assignment",
    "assgn": "assignment",
    "finaltermm": "finalterm",
    "finaltrem": "finalterm",
    "finaltem": "finalterm",
    "fainal": "final",
    "fianl": "final",
    "quizes": "quiz",
    "quizz": "quiz",
    "tets": "test",
    "tes": "test",
    "midetm": "midterm",
    "fanal": "final",
    "assinment": "assignment"
}


def normalize_number_words(text: str) -> str:
    """Convert Roman Urdu number words like 'ek', 'do', and 'teen' to digits."""
    normalized = text.lower().strip()
    for word, digit in NUMBER_WORDS.items():
        if word == digit:
            continue
        normalized = re.sub(rf"\b{re.escape(word)}\b", digit, normalized)
    return normalized


def normalize_voice_text(text: str) -> str:
    """Fix common voice spelling mistakes like 'midetem' and 'assigment'."""
    normalized = text.lower().strip()
    for wrong, correct in COMMON_SPELLING_FIXES.items():
        normalized = re.sub(rf"\b{re.escape(wrong)}\b", correct, normalized)
    return normalized


def find_column(text: str):
    for column, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if re.search(fr"\b{alias}\b", text):
                return column
    return None


def extract_numeric_values(text: str):
    """Convert spoken number words into digits in order of appearance."""
    values = []
    for token in re.findall(r"\d+|[a-z]+", text.lower()):
        cleaned = token.strip(".,;:!?()[]{}")
        if not cleaned:
            continue
        if cleaned.isdigit():
            values.append(int(cleaned))
        elif cleaned in NUMBER_WORDS:
            values.append(int(NUMBER_WORDS[cleaned]))
    return values


def extract_marks_pair(text: str):
    """Support English and Roman Urdu forms such as: 1 ka 85, roll no 1 marks 85, one twenty, and 1, 20 marks."""
    values = extract_numeric_values(text)

    if len(values) < 2:
        return None

    rollout_markers = bool(re.search(r"\broll\b|\bmarks?\b|\bka\b|\bkar\b|\bdo\b", text.lower()))
    if not rollout_markers:
        return None

    return values[0], values[1]


def _split_command_segments(text: str):
    """Split a spoken sentence into smaller commands when it contains chained actions."""
    cleaned = text.strip()
    if not cleaned:
        return []

    segments = [cleaned]
    roll_starts = re.split(r"(?=\broll\s*(?:no)?\b)", cleaned)
    if len(roll_starts) > 1:
        segments = [part.strip() for part in roll_starts if part.strip()]

    separators = [
        " and ", " then ", " next ", " also ", " after that ", " then after ",
        ", ", ";", " - "
    ]
    for separator in separators:
        new_segments = []
        for segment in segments:
            new_segments.extend(part.strip() for part in segment.split(separator) if part.strip())
        segments = new_segments

    return [segment for segment in segments if segment]


def _parse_single_command(text: str):
    text = normalize_voice_text(normalize_number_words(text.lower().strip()))

    if re.search(fr"\b({'|'.join(UNLOCK_KEYWORDS)})\b", text):
        clear_current_column()
        return {
            "type": "unlock"
        }

    column = find_column(text)
    active_column = get_current_column()
    if not column:
        column = active_column
    has_selection_word = bool(re.search(fr"\b({'|'.join(SELECTION_KEYWORDS)})\b", text))

    marks_pair = extract_marks_pair(text)

    if marks_pair:
        roll_no, marks = marks_pair
        resolved_column = column if column else active_column
        if resolved_column:
            set_current_column(resolved_column)
            return {
                "type": "marks",
                "roll_no": roll_no,
                "marks": marks,
                "column": resolved_column
            }

        return {
            "type": "marks",
            "roll_no": roll_no,
            "marks": marks
        }

    if column and has_selection_word:
        set_current_column(column)
        return {
            "type": "column",
            "column": column
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


def parse_voice_command(text: str):
    """Parse one or several chained voice commands from the same spoken sentence."""
    cleaned = normalize_voice_text(normalize_number_words((text or "").lower().strip()))
    if not cleaned:
        return {"type": "unknown"}

    segments = _split_command_segments(cleaned)
    if len(segments) > 1:
        parsed_segments = []
        final_result = {"type": "unknown"}

        for segment in segments:
            result = _parse_single_command(segment)
            if result["type"] == "unknown":
                continue
            parsed_segments.append(result)
            final_result = result

        if not parsed_segments:
            return {"type": "unknown"}

        if final_result["type"] in {"column", "marks"}:
            final_result = dict(final_result)
            final_result["multi"] = True
            final_result["commands"] = parsed_segments
            return final_result

        return final_result

    return _parse_single_command(cleaned)
