import re
from typing import Any
from functools import lru_cache

import openpyxl

try:
    from backend.config import EXCEL_FILE, MARKS_LIMITS
    from backend.services.session_service import get_current_column
except ModuleNotFoundError:  # pragma: no cover
    from config import EXCEL_FILE, MARKS_LIMITS
    from services.session_service import get_current_column


# ============================================================
# COLUMN HELPERS
# ============================================================

COLUMN_ALIASES = {
    "quiz": {
        "quiz",
        "quizzes",
        "quize",
    },
    "assignment": {
        "assignment",
        "assignments",
        "assign",
        "assigment",
    },
    "test": {
        "test",
        "tests",
    },
    "presentation": {
        "presentation",
        "present",
    },
    "midterm": {
        "midterm",
        "mid",
    },
    "final": {
        "final",
        "finals",
        "finalterm",
        "final term",
    },
}


COLUMN_HEADERS = {
    "quiz": "Quiz",
    "assignment": "Assignment",
    "test": "Test",
    "presentation": "Presentation",
    "midterm": "Midterm",
    "final": "Final",
}


def _normalize_header(value: Any) -> str:
    return re.sub(
        r"[^a-z0-9]+",
        "",
        str(value).strip().lower(),
    )


def _canonical_column(column: Any) -> str | None:
    if column is None:
        return None

    normalized = _normalize_header(column)

    aliases = {
        "quiz": "quiz",
        "quizzes": "quiz",
        "quize": "quiz",

        "assignment": "assignment",
        "assignments": "assignment",
        "assign": "assignment",
        "assigment": "assignment",

        "test": "test",
        "tests": "test",

        "presentation": "presentation",
        "present": "presentation",

        "midterm": "midterm",
        "mid": "midterm",

        "final": "final",
        "finals": "final",
        "finalterm": "final",
    }

    return aliases.get(normalized)


# ============================================================
# ROLL MATCHING
# ============================================================

def _roll_matches(existing_roll, requested_roll) -> bool:
    existing = str(existing_roll).strip().upper()
    requested = str(requested_roll).strip().upper()

    if existing == requested:
        return True

    if requested.isdigit():
        suffix = f"{int(requested):02d}"

        return (
            existing.endswith(f"-{suffix}")
            or existing.endswith(f"BSIT{suffix}")
        )

    if existing.isdigit():
        try:
            return requested.endswith(
                f"-{int(existing):02d}"
            )
        except ValueError:
            return False

    return False


# ============================================================
# READ STUDENTS
# ============================================================

@lru_cache(maxsize=1)
def _read_students_cached(
    file_signature: tuple[int, int],
) -> tuple[dict[str, Any], ...]:

    workbook = openpyxl.load_workbook(
        EXCEL_FILE,
        data_only=True,
    )

    sheet = workbook.active

    headers = [
        str(cell.value).strip()
        if cell.value is not None
        else ""
        for cell in sheet[1]
    ]

    students: list[dict[str, Any]] = []

    for row in range(
        2,
        sheet.max_row + 1,
    ):
        values = [
            sheet.cell(
                row=row,
                column=col,
            ).value
            for col in range(
                1,
                len(headers) + 1,
            )
        ]

        row_data: dict[str, Any] = {}

        for header, value in zip(
            headers,
            values,
        ):
            row_data[header] = value

        if not any(
            value is not None
            for value in row_data.values()
        ):
            continue

        student = {
            "rollNo": (
                row_data.get("Roll_No")
                or row_data.get("Roll No")
                or row_data.get("roll_no")
            ),
            "student_name": (
                row_data.get("Name")
                or row_data.get("Student_Name")
                or row_data.get("Student Name")
                or "Unknown"
            ),
        }

        for header in headers[1:]:
            student[header] = (
                row_data.get(header)
                if row_data.get(header) is not None
                else 0
            )

        students.append(student)

    workbook.close()

    return tuple(students)


def read_students() -> list[dict[str, Any]]:
    stat = EXCEL_FILE.stat()

    return [
        dict(student)
        for student in _read_students_cached(
            (
                stat.st_mtime_ns,
                stat.st_size,
            )
        )
    ]


# ============================================================
# EXCEL COLUMN RESOLUTION
# ============================================================

def _resolve_column_number(
    sheet,
    requested_column: str,
):
    canonical = _canonical_column(
        requested_column
    )

    if canonical is None:
        return None

    requested = _normalize_header(
        canonical
    )

    for cell in sheet[1]:
        if cell.value is None:
            continue

        header_name = str(
            cell.value
        ).strip()

        header_norm = _normalize_header(
            header_name
        )

        if header_norm == requested:
            return cell.column

        if canonical == "final":
            if header_norm in {
                "final",
                "finalterm",
                "finals",
            }:
                return cell.column

    return None


# ============================================================
# MARKS LIMITS
# ============================================================

def _get_marks_limit(
    column: str,
):
    """
    Required ranges:

    Quiz         1-5
    Test         1-10
    Assignment   1-10
    Presentation 1-10
    Midterm      1-40
    Final        1-50

    MARKS_LIMITS from config.py is respected first.
    If a value is missing there, these defaults are used.
    """

    canonical = _canonical_column(
        column
    )

    default_limits = {
        "quiz": (1, 5),
        "test": (1, 10),
        "assignment": (1, 10),
        "presentation": (1, 10),
        "midterm": (1, 40),
        "final": (1, 50),
    }

    configured = MARKS_LIMITS.get(
        canonical
    ) if canonical else None

    if configured is not None:
        return configured

    return default_limits.get(
        canonical
    )


# ============================================================
# UPDATE MARKS
# ============================================================

def update_marks(
    roll_no,
    marks: int,
    column: str | None = None,
):
    """
    Update marks for a student.

    Priority:
    1. Explicit column supplied by voice command.
    2. Current manually selected dashboard column.

    Marks are validated before Excel is modified.
    """

    requested_column = (
        column
        if column is not None
        else get_current_column()
    )

    canonical_column = _canonical_column(
        requested_column
    )

    if canonical_column is None:
        return (
            False,
            "No valid assessment column selected.",
        )

    # --------------------------------------------------------
    # Validate marks
    # --------------------------------------------------------

    try:
        marks = int(marks)
    except (
        TypeError,
        ValueError,
    ):
        return (
            False,
            f"{canonical_column.title()} marks must be a valid number.",
        )

    limits = _get_marks_limit(
        canonical_column
    )

    if limits is not None:
        minimum, maximum = limits

        if not (
            minimum
            <= marks
            <= maximum
        ):
            display_name = (
                "Final Term"
                if canonical_column == "final"
                else canonical_column.title()
            )

            return (
                False,
                f"{display_name} marks must be between "
                f"{minimum} and {maximum}.",
            )

    # --------------------------------------------------------
    # Open workbook
    # --------------------------------------------------------

    try:
        workbook = openpyxl.load_workbook(
            EXCEL_FILE,
            data_only=False,
        )
    except FileNotFoundError:
        return (
            False,
            "Marks Excel file was not found.",
        )
    except PermissionError:
        return (
            False,
            "Excel file is open in another program. "
            "Please close it and try again.",
        )

    try:
        sheet = workbook.active

        # ----------------------------------------------------
        # Find / create column
        # ----------------------------------------------------

        column_number = _resolve_column_number(
            sheet,
            canonical_column,
        )

        if column_number is None:
            header_name = COLUMN_HEADERS.get(
                canonical_column
            )

            if header_name is None:
                return (
                    False,
                    "Column not found.",
                )

            column_number = (
                sheet.max_column + 1
            )

            sheet.cell(
                row=1,
                column=column_number,
                value=header_name,
            )

        # ----------------------------------------------------
        # Find student
        # ----------------------------------------------------

        target_row = None

        for row in range(
            2,
            sheet.max_row + 1,
        ):
            if _roll_matches(
                sheet.cell(
                    row=row,
                    column=1,
                ).value,
                roll_no,
            ):
                target_row = row
                break

        # ----------------------------------------------------
        # Do not create unknown student accidentally
        # ----------------------------------------------------

        if target_row is None:
            return (
                False,
                f"Roll number {roll_no} was not found in the Excel sheet.",
            )

        # ----------------------------------------------------
        # Update marks
        # ----------------------------------------------------

        sheet.cell(
            row=target_row,
            column=column_number,
        ).value = marks

        try:
            workbook.save(
                EXCEL_FILE
            )

            _read_students_cached.cache_clear()

            display_name = (
                "Final Term"
                if canonical_column == "final"
                else canonical_column.title()
            )

            return (
                True,
                f"{display_name} marks updated successfully.",
            )

        except PermissionError:
            return (
                False,
                "Excel file is open in another program "
                "or is write-protected. "
                "Please close the file and try again.",
            )

        except OSError as exc:
            return (
                False,
                f"Could not update Excel file: {exc}",
            )

    finally:
        workbook.close()