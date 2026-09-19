import re

try:
    from backend.services.session_service import (
        clear_current_column,
        get_current_column,
        set_current_column,
    )
except ModuleNotFoundError:  # pragma: no cover
    from services.session_service import (
        clear_current_column,
        get_current_column,
        set_current_column,
    )


# ============================================================
# COLUMNS
# ============================================================

VALID_COLUMNS = [
    "quiz",
    "assignment",
    "test",
    "presentation",
    "midterm",
    "final",
]


COLUMN_ALIASES = {
    "quiz": [
        "quiz",
        "quizzes",
        "quize",
        "qiz",
        "queez",
    ],

    "assignment": [
        "assignment",
        "assignments",
        "assign",
        "assigment",
        "asignment",
        "assinment",
        "assgnment",
    ],

    "test": [
        "test",
        "tests",
        "tets",
        "tes",
    ],

    "presentation": [
        "presentation",
        "present",
        "presention",
        "presentaion",
        "presenation",
        "presnetation",
        "presntation",
        "presantation",
    ],

    "midterm": [
        "midterm",
        "mid term",
        "mid-term",
        "mid",
        "midetem",
        "mideterm",
        "midtem",
        "midtrem",
        "midetm",
    ],

    "final": [
        "final",
        "finals",
        "final term",
        "final-term",
        "finalterm",
        "fainal",
        "fanal",
        "fianl",
    ],
}


SELECTION_KEYWORDS = {
    "select",
    "selected",
    "selecting",
    "choose",
    "chosen",
    "set",
    "lock",
    "column",
}


UNLOCK_KEYWORDS = [
    "unlock",
    "clear column",
    "clear selection",
    "release column",
    "release selection",
    "cancel selection",
    "stop listening",
    "close microphone",
    "close mic",
    "turn off microphone",
    "turn off mic",
    "exit",
]


# ============================================================
# NUMBER WORDS
# ============================================================

NUMBER_WORDS = {
    "zero": 0,
    "o": 0,
    "oh": 0,

    "one": 1,
    "ek": 1,
    "ak": 1,

    "two": 2,
    "do": 2,

    "three": 3,
    "teen": 3,

    "four": 4,
    "char": 4,
    "chaar": 4,

    "five": 5,
    "panch": 5,
    "paanch": 5,

    "six": 6,
    "cheh": 6,
    "chay": 6,

    "seven": 7,
    "saat": 7,
    "sat": 7,

    "eight": 8,
    "ath": 8,
    "aath": 8,

    "nine": 9,
    "nau": 9,
    "nao": 9,

    "ten": 10,

    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,

    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
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
    "o": 0,
    "oh": 0,

    "one": 1,
    "ek": 1,
    "ak": 1,

    "two": 2,
    "do": 2,

    "three": 3,
    "teen": 3,

    "four": 4,
    "char": 4,
    "chaar": 4,

    "five": 5,
    "panch": 5,
    "paanch": 5,

    "six": 6,
    "cheh": 6,
    "chay": 6,

    "seven": 7,
    "saat": 7,
    "sat": 7,

    "eight": 8,
    "ath": 8,
    "aath": 8,

    "nine": 9,
    "nau": 9,
    "nao": 9,
}


# ============================================================
# ROMAN URDU NUMBERS
# ============================================================

ROMAN_URDU_NUMBERS = {
    "das": 10,

    "pachasi": 85,
    "pachpan": 55,
    "pachaas": 50,

    "chaalis": 40,
    "chalis": 40,

    "sattar": 70,
    "assi": 80,
    "nabbe": 90,
    "navay": 90,

    "saath": 60,

    "athais": 28,

    "pachees": 25,
    "pachis": 25,

    "baees": 22,
    "bais": 22,

    "teis": 23,
    "taees": 23,

    "chaubis": 24,
    "chobis": 24,

    "chabbis": 26,
    "sattais": 27,
    "untis": 29,

    "tees": 30,
    "iktees": 31,
    "battees": 32,
    "taintees": 33,
    "chauttees": 34,
    "paintees": 35,
    "chhatees": 36,
    "saintees": 37,
    "artees": 38,
    "untalees": 39,

    "iktaalis": 41,
    "bayalees": 42,
    "tentaalis": 43,
    "chavalis": 44,
    "paintalees": 45,
    "siyalees": 46,
    "sentaalis": 47,
    "artalees": 48,
    "unchaas": 49,

    "ikawan": 51,
    "bawan": 52,
    "tirpan": 53,
    "chauwan": 54,

    "chhappan": 56,
    "sattavan": 57,
    "athawan": 58,
    "unsath": 59,

    "iksath": 61,
    "basath": 62,
    "tirsath": 63,
    "chausath": 64,
    "painsath": 65,
    "chhiyasath": 66,
    "sarsath": 67,
    "arsath": 68,
    "unhattar": 69,

    "ikhattar": 71,
    "bahattar": 72,
    "tihattar": 73,
    "chauhattar": 74,
    "pachattar": 75,
    "chihattar": 76,
    "sathattar": 77,
    "athattar": 78,
    "unasi": 79,

    "ikyan": 81,
    "bayasi": 82,
    "tirasi": 83,
    "churasi": 84,
    "chiyasi": 86,
    "sattasi": 87,
    "athasi": 88,
    "nawasi": 89,

    "ikyanave": 91,
    "baanave": 92,
    "tiryanave": 93,
    "chauranave": 94,
    "panchanave": 95,
    "chiyanave": 96,
    "sattanave": 97,
    "athaanave": 98,
    "ninnanave": 99,
}


# ============================================================
# SPELLING FIXES
# ============================================================

COMMON_SPELLING_FIXES = {
    "role": "roll",
    "rol": "roll",
    "rool": "roll",

    "maks": "marks",
    "max": "marks",
    "mark": "marks",
    "score": "marks",
    "scores": "marks",

    "number": "no",
    "num": "no",

    "assigment": "assignment",
    "asignment": "assignment",
    "assgnment": "assignment",
    "assinment": "assignment",
    "assgn": "assignment",

    "midetem": "midterm",
    "mideterm": "midterm",
    "midtem": "midterm",
    "midtrem": "midterm",
    "midtermm": "midterm",
    "middterm": "midterm",
    "midetm": "midterm",

    "quize": "quiz",
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

    "fainal": "final",
    "fanal": "final",
    "fianl": "final",
    "finals": "final",
}


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_voice_text(
    text: str,
) -> str:

    text = (
        text or ""
    ).lower().strip()

    text = re.sub(
        r"[-_/]",
        " ",
        text,
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    for wrong, correct in (
        COMMON_SPELLING_FIXES.items()
    ):
        text = re.sub(
            rf"\b{re.escape(wrong)}\b",
            correct,
            text,
        )

    return text.strip()


# ============================================================
# ROLL NORMALIZATION
# ============================================================

def normalize_spoken_roll(
    value: str,
):
    value = str(value).strip()

    compact = re.sub(
        r"\s+",
        "",
        value,
    ).upper()

    match = re.fullmatch(
        r"(\d{2})BSIT-?(\d{1,3})",
        compact,
    )

    if match:
        return (
            f"{match.group(1)}BSIT-"
            f"{int(match.group(2)):02d}"
        )

    if compact.isdigit():
        return int(compact)

    return compact


# ============================================================
# NUMBER PARSER
# ============================================================

def _replace_compound_numbers(
    text: str,
) -> str:

    for tens_word, tens_value in sorted(
        TENS_WORDS.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        for ones_word, ones_value in sorted(
            ONE_WORDS.items(),
            key=lambda item: len(item[0]),
            reverse=True,
        ):
            pattern = (
                rf"\b{re.escape(tens_word)}"
                rf"(?:\s+and)?\s+"
                rf"{re.escape(ones_word)}\b"
            )

            text = re.sub(
                pattern,
                str(
                    tens_value
                    + ones_value
                ),
                text,
            )

    return text


def normalize_number_words(
    text: str,
) -> str:

    text = normalize_voice_text(
        text
    )

    for word, number in sorted(
        ROMAN_URDU_NUMBERS.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        text = re.sub(
            rf"\b{re.escape(word)}\b",
            str(number),
            text,
        )

    text = _replace_compound_numbers(
        text
    )

    for word, number in sorted(
        NUMBER_WORDS.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        text = re.sub(
            rf"\b{re.escape(word)}\b",
            str(number),
            text,
        )

    return text


# ============================================================
# COLUMN
# ============================================================

def find_column(
    text: str,
):

    normalized = normalize_voice_text(
        text
    )

    found = []

    for column, aliases in (
        COLUMN_ALIASES.items()
    ):
        for alias in aliases:

            alias_pattern = re.escape(
                alias
            ).replace(
                r"\ ",
                r"\s+",
            )

            match = re.search(
                rf"\b{alias_pattern}\b",
                normalized,
            )

            if match:
                found.append(
                    (
                        match.start(),
                        -len(alias),
                        column,
                    )
                )

    if not found:
        return None

    found.sort()

    return found[0][2]


# ============================================================
# ROLL
# ============================================================

def _find_roll(
    text: str,
):

    normalized = normalize_number_words(
        text
    )

    patterns = [
        (
            r"\broll\s*(?:no|number)?\s*"
            r"((?:\d+\s*bsit\s*-?\s*\d+)|\d+)"
        ),

        (
            r"\bstudent\s*(?:no|number)?\s*"
            r"(\d+)"
        ),

        (
            r"\b(?:number|no)\s*(\d+)"
        ),
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            normalized,
        )

        if match:
            return normalize_spoken_roll(
                match.group(1)
            )

    return None


# ============================================================
# MARKS
# ============================================================

def _find_marks(
    text: str,
):

    normalized = normalize_number_words(
        text
    )

    # marks 85
    match = re.search(
        r"\bmarks?\s*"
        r"(?:are|is|of|=|to|at|mein)?\s*"
        r"(\d{1,3})\b",
        normalized,
    )

    if match:
        return int(
            match.group(1)
        )

    # 85 marks
    match = re.search(
        r"\b(\d{1,3})\s+marks?\b",
        normalized,
    )

    if match:
        return int(
            match.group(1)
        )

    # give 85 / de do 85 / kar do 85
    match = re.search(
        r"\b(?:give|put|enter|add|set|make|"
        r"do|de|kar|laga|update)\b"
        r".*?\b(\d{1,3})\b",
        normalized,
    )

    if match:
        return int(
            match.group(1)
        )

    # Natural phrase:
    # quiz score 85
    match = re.search(
        r"\b(?:score|marks?)\s*"
        r"(\d{1,3})\b",
        normalized,
    )

    if match:
        return int(
            match.group(1)
        )

    return None


def extract_numeric_values(
    text: str,
):

    normalized = normalize_number_words(
        text
    )

    values = []

    for token in re.findall(
        r"\d+",
        normalized,
    ):
        try:
            values.append(
                int(token)
            )
        except ValueError:
            pass

    return values


# ============================================================
# COMMAND SEGMENTS
# ============================================================

def _split_command_segments(
    text: str,
):

    text = normalize_voice_text(
        text
    )

    roll_matches = list(
        re.finditer(
            r"\broll\s*(?:no|number)?\b",
            text,
        )
    )

    if len(roll_matches) > 1:

        segments = []

        for index, match in enumerate(
            roll_matches
        ):

            start = match.start()

            if index + 1 < len(
                roll_matches
            ):
                end = roll_matches[
                    index + 1
                ].start()
            else:
                end = len(text)

            segment = text[
                start:end
            ].strip()

            segment = re.sub(
                r"^(?:and|then|also|next)\s+",
                "",
                segment,
            )

            if segment:
                segments.append(
                    segment
                )

        return segments

    return [text]


# ============================================================
# SINGLE COMMAND
# ============================================================

def _parse_single_command(
    text: str,
    inherited_column=None,
):

    original = text

    text = normalize_number_words(
        text
    )

    # --------------------------------------------------------
    # UNLOCK
    # --------------------------------------------------------

    unlock_pattern = "|".join(
        re.escape(item)
        for item in UNLOCK_KEYWORDS
    )

    if re.search(
        rf"\b(?:{unlock_pattern})\b",
        text,
    ):
        clear_current_column()

        return {
            "type": "unlock"
        }

    # --------------------------------------------------------
    # EXPLICIT VOICE COLUMN
    # --------------------------------------------------------

    explicit_column = find_column(
        text
    )

    # Voice column gets priority.
    column = (
        explicit_column
        or inherited_column
    )

    roll_no = _find_roll(
        text
    )

    marks = _find_marks(
        text
    )

    # --------------------------------------------------------
    # ROLL + MARKS
    # --------------------------------------------------------

    if (
        roll_no is not None
        and marks is not None
    ):

        if column:

            return {
                "type": "marks",
                "roll_no": roll_no,
                "marks": marks,
                "column": column,
                "explicit_column": (
                    explicit_column
                    is not None
                ),
            }

        return {
            "type": "marks",
            "roll_no": roll_no,
            "marks": marks,
            "column": None,
            "needs_column": True,
            "message": (
                "Which assessment should I update? "
                "Please select a column or say "
                "Quiz, Assignment, Test, Presentation, "
                "Midterm, or Final."
            ),
        }

    # --------------------------------------------------------
    # COLUMN ONLY
    # --------------------------------------------------------

    if (
        explicit_column
        and roll_no is None
    ):

        selection_words = re.search(
            r"\b(select|set|choose|lock|column)\b",
            text,
        )

        if selection_words:

            set_current_column(
                explicit_column
            )

            return {
                "type": "column",
                "column": explicit_column,
            }

    # --------------------------------------------------------
    # ROLL BUT NO MARKS
    # --------------------------------------------------------

    if (
        roll_no is not None
        and marks is None
    ):

        return {
            "type": "incomplete",
            "roll_no": roll_no,
            "column": column,
            "message": (
                f"I found Roll {roll_no}, "
                "but I could not understand the marks. "
                "Please say the marks."
            ),
        }

    # --------------------------------------------------------
    # MARKS BUT NO ROLL
    # --------------------------------------------------------

    if (
        marks is not None
        and roll_no is None
    ):

        return {
            "type": "incomplete",
            "marks": marks,
            "column": column,
            "message": (
                f"I found {marks} marks, "
                "but I could not understand "
                "the roll number."
            ),
        }

    return {
        "type": "unknown",
        "message": (
            "I could not understand the command. "
            "Please say the roll number and marks."
        ),
        "raw_text": original,
    }


# ============================================================
# SAME ROLL - MULTIPLE ASSESSMENTS
# ============================================================

def _extract_same_roll_multiple(
    text: str,
):

    normalized = normalize_number_words(
        text
    )

    roll_no = _find_roll(
        normalized
    )

    if roll_no is None:
        return []

    entries = []

    column_positions = []

    for column, aliases in (
        COLUMN_ALIASES.items()
    ):

        for alias in aliases:

            pattern = re.escape(
                alias
            ).replace(
                r"\ ",
                r"\s+",
            )

            match = re.search(
                rf"\b{pattern}\b",
                normalized,
            )

            if match:

                column_positions.append(
                    (
                        match.start(),
                        match.end(),
                        column,
                    )
                )

    column_positions.sort()

    for index, (
        start,
        end,
        column,
    ) in enumerate(
        column_positions
    ):

        next_start = (
            column_positions[
                index + 1
            ][0]
            if index + 1
            < len(column_positions)
            else len(normalized)
        )

        part = normalized[
            end:next_start
        ]

        marks_match = re.search(
            r"\b(\d{1,3})\b",
            part,
        )

        if not marks_match:
            continue

        marks = int(
            marks_match.group(1)
        )

        entries.append(
            {
                "type": "marks",
                "roll_no": roll_no,
                "marks": marks,
                "column": column,
                "explicit_column": True,
            }
        )

    return entries


# ============================================================
# MAIN PARSER
# ============================================================

def parse_voice_command(
    text: str,
):

    text = (
        text or ""
    ).strip()

    if not text:

        return {
            "type": "unknown",
            "message": "Please say a command.",
        }

    normalized = normalize_voice_text(
        text
    )

    active_column = get_current_column()

    # --------------------------------------------------------
    # Same roll / multiple assessments
    # --------------------------------------------------------

    same_roll_commands = (
        _extract_same_roll_multiple(
            normalized
        )
    )

    if len(
        same_roll_commands
    ) >= 2:

        return {
            "type": "marks",
            "multi": True,
            "commands": same_roll_commands,
            "column": (
                same_roll_commands[
                    0
                ]["column"]
            ),
        }

    # --------------------------------------------------------
    # Multiple roll commands
    # --------------------------------------------------------

    segments = _split_command_segments(
        normalized
    )

    if len(segments) > 1:

        commands = []

        for segment in segments:

            parsed = _parse_single_command(
                segment,
                inherited_column=active_column,
            )

            if parsed.get(
                "type"
            ) == "marks":

                commands.append(
                    parsed
                )

        if commands:

            return {
                "type": "marks",
                "multi": (
                    len(commands)
                    > 1
                ),
                "commands": commands,
                "column": (
                    commands[0].get(
                        "column"
                    )
                    if commands
                    else active_column
                ),
            }

    # --------------------------------------------------------
    # Normal single command
    # --------------------------------------------------------

    return _parse_single_command(
        normalized,
        inherited_column=active_column,
    )