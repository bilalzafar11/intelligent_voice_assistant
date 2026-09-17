import re
from typing import Any

import openpyxl

try:
    from backend.config import EXCEL_FILE, MARKS_LIMITS
    from backend.services.session_service import get_current_column
except ModuleNotFoundError:  # pragma: no cover
    from config import EXCEL_FILE, MARKS_LIMITS
    from services.session_service import get_current_column


def _normalize_header(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value).strip().lower())


def _roll_matches(existing_roll, requested_roll) -> bool:
    existing = str(existing_roll).strip().upper()
    requested = str(requested_roll).strip().upper()
    if existing == requested:
        return True
    if requested.isdigit():
        suffix = f"{int(requested):02d}"
        return existing.endswith(f"-{suffix}") or existing.endswith(f"BSIT{suffix}")
    return existing.isdigit() and requested.endswith(f"-{int(existing):02d}")


def read_students() -> list[dict[str, Any]]:
    """Read the Excel workbook and return student rows using the actual workbook headers."""
    workbook = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    sheet = workbook.active

    headers = [str(cell.value).strip() if cell.value is not None else "" for cell in sheet[1]]
    students: list[dict[str, Any]] = []

    for row in range(2, sheet.max_row + 1):
        values = [sheet.cell(row=row, column=col).value for col in range(1, len(headers) + 1)]
        row_data: dict[str, Any] = {}

        for header, value in zip(headers, values):
            row_data[header] = value

        if any(v is not None for v in row_data.values()):
            student = {
                "rollNo": row_data.get("Roll_No") or row_data.get("Roll No") or row_data.get("roll_no"),
                "student_name": row_data.get("Name") or row_data.get("Student_Name") or row_data.get("Student Name") or "Unknown",
            }
            for header in headers[1:]:
                student[header] = row_data.get(header, 0) or 0
            students.append(student)

    workbook.close()
    return students


def _resolve_column_number(sheet, requested_column: str):
    requested = _normalize_header(requested_column)
    for cell in sheet[1]:
        if cell.value is None:
            continue
        header_name = str(cell.value).strip()
        header_norm = _normalize_header(header_name)
        if header_norm == requested:
            return cell.column
        if requested in {"quiz", "assignment", "test", "presentation", "midterm", "final", "finalterm"}:
            aliases = {
            "quiz": {"quiz", "quize", "quizzes"},
                "assignment": {"assignment"},
            "test": {"test"},
            "presentation": {"presentation"},
                "midterm": {"midterm", "mid"},
                "final": {"final", "finalterm", "finals"},
                "finalterm": {"final", "finalterm", "finals"},
            }
            if header_norm in aliases.get(requested, set()):
                return cell.column
    return None


def update_marks(roll_no: int, marks: int):
    """Update a student's marks in the selected Excel column or create a new row if missing."""
    workbook = openpyxl.load_workbook(EXCEL_FILE, data_only=False)
    try:
        sheet = workbook.active

        current_column = get_current_column()
        if current_column is None:
            return False, "No column selected."

        limits = MARKS_LIMITS.get(_normalize_header(current_column))
        if limits is not None:
            minimum, maximum = limits
            if not minimum <= marks <= maximum:
                return False, f"{current_column.title()} marks must be between {minimum} and {maximum}."

        column_number = _resolve_column_number(sheet, current_column)
        if column_number is None:
            column_headers = {
                "quiz": "Quiz",
                "assignment": "Assignment",
                "test": "Test",
                "presentation": "Presentation",
                "midterm": "Midterm",
                "final": "Finalterm",
                "finalterm": "Finalterm",
            }
            header_name = column_headers.get(_normalize_header(current_column))
            if header_name is None:
                return False, "Column not found."
            column_number = sheet.max_column + 1
            sheet.cell(row=1, column=column_number, value=header_name)

        target_row = None
        for row in range(2, sheet.max_row + 1):
            if _roll_matches(sheet.cell(row=row, column=1).value, roll_no):
                target_row = row
                break

        created_new_row = False
        if target_row is None:
            target_row = sheet.max_row + 1
            sheet.cell(row=target_row, column=1, value=roll_no)
            created_new_row = True

        sheet.cell(row=target_row, column=column_number).value = marks
        try:
            workbook.save(EXCEL_FILE)
            if created_new_row:
                return True, "New row created and marks updated successfully."
            return True, "Marks Updated Successfully."
        except PermissionError:
            return False, "Excel file is open in another program or is write-protected. Close the file and try again."
        except OSError as exc:
            return False, f"Could not update Excel file: {exc}"
    finally:
        workbook.close()