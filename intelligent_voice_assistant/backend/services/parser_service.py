import re

try:
    from backend.services.session_service import clear_current_column, get_current_column, set_current_column
except ModuleNotFoundError:  # pragma: no cover
    from services.session_service import clear_current_column, get_current_column, set_current_column


VALID_COLUMNS = [
    "quiz",
    "assignment",
    "test",
    "presentation",
    "midterm",
    "final",
    "finalterm"
]

COLUMN_ALIASES = {
    "quiz": ["quiz", "quize", "quizzes", "quiz column"],
    "assignment": ["assignment", "assign", "assignment column"],
    "test": ["test", "test column"],
    "presentation": ["presentation", "presentation column"],
    "midterm": ["midterm", "mid term", "mid-term", "mid"],
    "final": ["final", "final term", "final-term", "finalterm", "finals"],
    "finalterm": ["finalterm", "final term", "final-term", "final", "finals"]
}

SELECTION_KEYWORDS = ["lock", "select", "set", "choose", "column", "subject"]
UNLOCK_KEYWORDS = [
    "exit",
    "unlock",
    "clear",
    "release",
    "cancel",
    "stop",
    "close microphone",
    "close mic",
    "stop listening",
    "turn off microphone",
    "turn off mic",
    "close listening"
]
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

TENS_WORDS = {
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}

ONE_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "o": 0,
    "ek": 1,
    "do": 2,
    "teen": 3,
    "char": 4,
    "chaar": 4,
    "panch": 5,
    "cheh": 6,
    "saat": 7,
    "ath": 8,
    "nau": 9,
}

COMMON_SPELLING_FIXES = {
    "role": "roll",
    "rol": "roll",
    "maks": "marks",
    "max": "marks",
    "mark": "marks",
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
    "qiz": "quiz",
    "queez": "quiz",
    "tets": "test",
    "tes": "test",
    "tests": "test",
    "present": "presentation",
    "presention": "presentation",
    "presentaion": "presentation",
    "presenation": "presentation",
    "presnetation": "presentation",
    "presntation": "presentation",
    "presantation": "presentation",
    "midetm": "midterm",
    "fanal": "final",
    "assinment": "assignment"
}

COMMON_COMMAND_WORDS = {
    "number": "no",
    "num": "no",
    "maks": "marks",
    "mark": "marks",
    "score": "marks",
    "scored": "marks",
    "update": "marks",
    "updated": "marks",
    "enter": "marks",
    "add": "marks",
}


def normalize_spoken_roll(value: str):
    compact = re.sub(r"\s+", "", value).upper()
    match = re.fullmatch(r"(\d{2})BSIT-?(\d{1,2})", compact)
    if match:
        return f"{match.group(1)}BSIT-{int(match.group(2)):02d}"
    return compact


def normalize_number_words(text: str) -> str:
    """Convert Roman Urdu number words like 'ek', 'do', and 'teen' to digits, including compound forms like 'eighty five'."""
    normalized = text.lower().strip()

    for tens_word, tens_value in sorted(TENS_WORDS.items(), key=lambda item: len(item[0]), reverse=True):
        for ones_word, ones_value in sorted(ONE_WORDS.items(), key=lambda item: len(item[0]), reverse=True):
            normalized = re.sub(
                rf"\b{re.escape(tens_word)}\s+{re.escape(ones_word)}\b",
                str(tens_value + ones_value),
                normalized,
            )

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
    for spoken, correct in COMMON_COMMAND_WORDS.items():
        normalized = re.sub(rf"\b{re.escape(spoken)}\b", correct, normalized)
    return normalized


def find_column(text: str):
    normalized = normalize_voice_text(text)
    for column, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_pattern = re.escape(alias).replace(r"\ ", r"\\s+")
            if re.search(rf"\b{alias_pattern}\b", normalized):
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
    """Support natural spoken forms such as: roll no 1 marks 85, marks 85 roll no 1, and assignment ka 1 par 85."""
    normalized = normalize_voice_text(normalize_number_words(text.lower().strip()))
    if not re.search(r"\broll\b|\bmarks?\b|\bka\b|\bkar\b|\bdo\b", normalized):
        return None

    roll_match = re.search(
        r"\broll\b(?:\s*(?:no|number))?\s*((?:\d+\s*bsit\s*[- ]?\s*\d+)|\d+)",
        normalized,
    )
    marks_match = re.search(r"\bmarks?\b\s*(\d+)", normalized)

    if roll_match and marks_match:
        roll_number = normalize_spoken_roll(roll_match.group(1))
        return (
            int(roll_number) if roll_number.isdigit() else roll_number,
            int(marks_match.group(1)),
        )

    values = extract_numeric_values(normalized)
    if len(values) >= 2:
        return values[0], values[1]

    return None


def extract_row_wise_marks(text: str):
    """Extract several column marks for one roll number from a single command."""
    normalized = normalize_voice_text(normalize_number_words(text.lower().strip()))
    roll_match = re.search(
        r"\broll\b(?:\s*(?:no|number))?\s*((?:\d+\s*bsit\s*[- ]?\s*\d+)|\d+)",
        normalized,
    )
    if not roll_match:
        return []

    entries = []
    remaining = normalized[roll_match.end():]
    for column, aliases in COLUMN_ALIASES.items():
        if column == "finalterm" and any(entry["column"] == "final" for entry in entries):
            continue
        alias_pattern = "|".join(
            re.escape(alias).replace(r"\ ", r"\s+") for alias in aliases
        )
        match = re.search(
            rf"\b(?:{alias_pattern})\b\s*(?:marks?|number|is|are|ka|ke|par)?\s*(\d+)",
            remaining,
        )
        if match:
            entries.append({
                "type": "marks",
                "roll_no": (
                    int(roll_match.group(1))
                    if roll_match.group(1).isdigit()
                    else normalize_spoken_roll(roll_match.group(1))
                ),
                "marks": int(match.group(1)),
                "column": column,
            })

    return entries


def _split_command_segments(text: str):
    """Split a spoken sentence into smaller commands when it contains chained actions."""
    cleaned = text.strip()
    if not cleaned:
        return []

    segments = [cleaned]
    roll_occurrences = len(re.findall(r"\broll\b", cleaned))
    if roll_occurrences > 1:
        roll_starts = re.split(r"(?=\broll\s*(?:no)?\b)", cleaned)
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

    stop_pattern = r"(?:\bexit\b|\bstop\b|\bunlock\b|\bclear\b|\brelease\b|\bcancel\b|\bclose\s+microphone\b|\bclose\s+mic\b|\bstop\s+listening\b|\bturn\s+off\s+microphone\b|\bturn\s+off\s+mic\b|\bclose\s+listening\b)"
    if re.search(stop_pattern, text):
        clear_current_column()
        return {
            "type": "unlock"
        }

    column = find_column(text)
    active_column = get_current_column()
    if not column:
        column = active_column
    has_selection_word = bool(re.search(fr"\b({'|'.join(SELECTION_KEYWORDS)})\b", text))

    row_wise_entries = extract_row_wise_marks(text)
    if len(row_wise_entries) > 1:
        return {
            "type": "marks",
            "roll_no": row_wise_entries[0]["roll_no"],
            "marks": row_wise_entries[0]["marks"],
            "column": row_wise_entries[0]["column"],
            "multi": True,
            "commands": row_wise_entries,
        }

    marks_pair = extract_marks_pair(text)

    if not marks_pair and column:
        roll_match = re.search(
            r"\broll\b(?:\s*(?:no|number))?\s*((?:\d+\s*bsit\s*[- ]?\s*\d+)|\d+)",
            text,
        )
        marks_match = re.search(r"\bmarks?\b\s*(\d+)", text)
        if roll_match and marks_match:
            raw_roll = roll_match.group(1)
            marks_pair = (
                int(raw_roll) if raw_roll.isdigit() else normalize_spoken_roll(raw_roll),
                int(marks_match.group(1)),
            )

    if marks_pair:
        roll_no, marks = marks_pair
        resolved_column = column if column else active_column
        if resolved_column:
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
        return {
            "type": "voice_column_ignored",
            "column": column,
            "message": "Voice column selection is disabled. Say roll number, assessment, and marks together."
        }

    if column:
        return {
            "type": "voice_column_ignored",
            "column": column,
            "message": "Voice column selection is disabled. Say roll number, assessment, and marks together."
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

    result = _parse_single_command(cleaned)
    if result["type"] == "marks" and find_column(cleaned) and not result.get("multi"):
        result = dict(result)
        result["multi"] = True
        result["commands"] = [result.copy()]
    return result
