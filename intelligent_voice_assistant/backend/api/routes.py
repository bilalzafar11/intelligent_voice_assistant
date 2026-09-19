import fastapi  # type: ignore

from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from fastapi import File, UploadFile

from pathlib import Path

import json
import re

from datetime import datetime

import openpyxl


try:
    from backend.services.excel_service import (
        read_students,
        update_marks,
    )

    from backend.services.parser_service import (
        parse_voice_command,
    )

    from backend.services.session_service import (
        clear_current_column,
        get_current_column,
        set_current_column,
    )

    from backend.services.speech_service import (
        listen_and_transcribe,
        speech_to_text,
    )

except ModuleNotFoundError:  # pragma: no cover

    from services.excel_service import (
        read_students,
        update_marks,
    )

    from services.parser_service import (
        parse_voice_command,
    )

    from services.session_service import (
        clear_current_column,
        get_current_column,
        set_current_column,
    )

    from services.speech_service import (
        listen_and_transcribe,
        speech_to_text,
    )


from database import SessionLocal
from models import MarksSheet, Subject


router = fastapi.APIRouter()


# =========================================================
# REQUEST MODELS
# =========================================================

class VoiceCommandRequest(BaseModel):
    text: str


class SetColumnRequest(BaseModel):
    column: str


class SheetRequest(BaseModel):
    teacher_id: int
    subject_id: int
    name: str = ""
    status: str = Field(
        pattern="^(draft|saved)$"
    )
    rows: list[dict] = Field(
        default_factory=list
    )
    sheet_id: int | None = None


# =========================================================
# SHEET HELPERS
# =========================================================

def _sheet_dict(
    sheet: MarksSheet,
):
    return {
        "id": sheet.id,
        "teacher_id": sheet.teacher_id,
        "subject_id": sheet.subject_id,
        "name": sheet.name,
        "status": sheet.status,
        "rows": json.loads(
            sheet.rows_json or "[]"
        ),
        "created_at": (
            sheet.created_at.isoformat()
            if sheet.created_at
            else None
        ),
        "updated_at": (
            sheet.updated_at.isoformat()
            if sheet.updated_at
            else None
        ),
    }


def _owned_subject(
    db,
    teacher_id: int,
    subject_id: int,
):

    return (
        db.query(Subject)
        .filter(
            Subject.id == subject_id,
            Subject.teacher_id == teacher_id,
        )
        .first()
    )


# =========================================================
# SHEETS
# =========================================================

@router.get(
    "/sheets/{teacher_id}"
)
def list_sheets(
    teacher_id: int,
    subject_id: int | None = None,
    status: str | None = None,
):

    db = SessionLocal()

    try:

        query = (
            db.query(MarksSheet)
            .filter(
                MarksSheet.teacher_id
                == teacher_id
            )
        )

        if subject_id is not None:

            query = query.filter(
                MarksSheet.subject_id
                == subject_id
            )

        if status in {
            "draft",
            "saved",
        }:

            query = query.filter(
                MarksSheet.status
                == status
            )

        return {
            "success": True,
            "sheets": [
                _sheet_dict(sheet)
                for sheet in query.order_by(
                    MarksSheet.updated_at.desc()
                ).all()
            ],
        }

    finally:
        db.close()


@router.post(
    "/sheets"
)
def save_sheet(
    payload: SheetRequest,
):

    db = SessionLocal()

    try:

        if not _owned_subject(
            db,
            payload.teacher_id,
            payload.subject_id,
        ):

            raise fastapi.HTTPException(
                status_code=403,
                detail=(
                    "This subject does not belong "
                    "to this teacher."
                ),
            )

        sheet = None

        if payload.sheet_id is not None:

            sheet = (
                db.query(MarksSheet)
                .filter(
                    MarksSheet.id
                    == payload.sheet_id,
                    MarksSheet.teacher_id
                    == payload.teacher_id,
                    MarksSheet.subject_id
                    == payload.subject_id,
                )
                .first()
            )

        if sheet is None:

            sheet = MarksSheet(
                teacher_id=payload.teacher_id,
                subject_id=payload.subject_id,
                name=(
                    payload.name.strip()
                    or "Untitled sheet"
                ),
                status=payload.status,
            )

            db.add(sheet)

        sheet.name = (
            payload.name.strip()
            or sheet.name
            or "Untitled sheet"
        )

        sheet.status = payload.status

        sheet.rows_json = json.dumps(
            payload.rows
        )

        sheet.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(sheet)

        return {
            "success": True,
            "sheet": _sheet_dict(sheet),
        }

    finally:
        db.close()


@router.delete(
    "/sheets/{teacher_id}/{sheet_id}"
)
def delete_sheet(
    teacher_id: int,
    sheet_id: int,
):

    db = SessionLocal()

    try:

        sheet = (
            db.query(MarksSheet)
            .filter(
                MarksSheet.id == sheet_id,
                MarksSheet.teacher_id
                == teacher_id,
            )
            .first()
        )

        if not sheet:

            raise fastapi.HTTPException(
                status_code=404,
                detail="Sheet not found.",
            )

        db.delete(sheet)
        db.commit()

        return {
            "success": True
        }

    finally:
        db.close()


@router.get(
    "/sheets/{teacher_id}/{sheet_id}/download"
)
def download_sheet(
    teacher_id: int,
    sheet_id: int,
):

    db = SessionLocal()

    try:

        sheet = (
            db.query(MarksSheet)
            .filter(
                MarksSheet.id == sheet_id,
                MarksSheet.teacher_id
                == teacher_id,
            )
            .first()
        )

        if not sheet:

            raise fastapi.HTTPException(
                status_code=404,
                detail="Sheet not found.",
            )

        rows = json.loads(
            sheet.rows_json or "[]"
        )

        workbook = openpyxl.Workbook()

        worksheet = workbook.active

        worksheet.title = "Marks"

        headers = [
            "Roll No",
            "Name",
            "Quiz",
            "Test",
            "Assignment",
            "Presentation",
            "Midterm",
            "Final",
        ]

        worksheet.append(headers)

        for row in rows:

            worksheet.append(
                [
                    row.get(
                        "roll_no",
                        "",
                    ),
                    row.get(
                        "name",
                        "",
                    ),
                    row.get(
                        "quiz",
                        0,
                    ),
                    row.get(
                        "test",
                        0,
                    ),
                    row.get(
                        "assignment",
                        0,
                    ),
                    row.get(
                        "presentation",
                        0,
                    ),
                    row.get(
                        "midterm",
                        0,
                    ),
                    row.get(
                        "final",
                        0,
                    ),
                ]
            )

        report_dir = (
            Path(__file__)
            .resolve()
            .parents[2]
            / "reports"
        )

        report_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        safe_name = re.sub(
            r"[^a-zA-Z0-9_-]+",
            "_",
            sheet.name,
        ).strip("_") or "marks_sheet"

        output_path = (
            report_dir
            / f"{safe_name}_{sheet.id}.xlsx"
        )

        workbook.save(
            output_path
        )

        workbook.close()

        return FileResponse(
            path=output_path,
            media_type=(
                "application/"
                "vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
            filename=f"{safe_name}.xlsx",
        )

    finally:
        db.close()


# =========================================================
# VOICE RESPONSE BUILDER
# =========================================================

def _build_response_for_result(
    text: str,
    result: dict,
):

    result_type = result.get(
        "type"
    )

    # -----------------------------------------------------
    # UNLOCK
    # -----------------------------------------------------

    if result_type == "unlock":

        clear_current_column()

        return {
            "success": True,
            "message": (
                "Column unlocked. "
                "You can select a new column now."
            ),
            "text": text,
            "updated": False,
            "selected_column": None,
        }

    # -----------------------------------------------------
    # COLUMN SELECTED BY VOICE
    # -----------------------------------------------------

    if result_type == "column":

        selected_column = result.get(
            "column"
        )

        set_current_column(
            selected_column
        )

        display_name = (
            "Final Term"
            if selected_column == "final"
            else selected_column.title()
        )

        return {
            "success": True,
            "message": (
                f"Column selected: "
                f"{display_name}. "
                "Now say the roll number and marks."
            ),
            "text": text,
            "updated": False,
            "selected_column": selected_column,
        }

    # -----------------------------------------------------
    # INCOMPLETE
    # -----------------------------------------------------

    if result_type == "incomplete":

        return {
            "success": False,
            "message": result.get(
                "message",
                "The command is incomplete.",
            ),
            "text": text,
            "updated": False,
            "error": True,
            "selected_column": (
                result.get("column")
                or get_current_column()
            ),
        }

    # -----------------------------------------------------
    # UNKNOWN
    # -----------------------------------------------------

    if result_type == "unknown":

        return {
            "success": False,
            "message": result.get(
                "message",
                "I could not understand the command.",
            ),
            "text": text,
            "updated": False,
            "error": True,
            "selected_column": (
                get_current_column()
            ),
        }

    # -----------------------------------------------------
    # MULTIPLE COMMANDS
    # -----------------------------------------------------

    if (
        result_type == "marks"
        and result.get("multi")
        and isinstance(
            result.get("commands"),
            list,
        )
    ):

        commands = result[
            "commands"
        ]

        results = []

        total_updated = 0

        dashboard_column = (
            get_current_column()
        )

        for command in commands:

            if command.get(
                "type"
            ) != "marks":
                continue

            roll_no = command.get(
                "roll_no"
            )

            marks = command.get(
                "marks"
            )

            # Voice column has priority.
            command_column = (
                command.get("column")
                or dashboard_column
            )

            if not command_column:

                results.append(
                    {
                        "roll_no": roll_no,
                        "marks": marks,
                        "column": None,
                        "updated": False,
                        "error": True,
                        "message": (
                            "Which assessment should I "
                            "update? Please select a column "
                            "or say Quiz, Assignment, Test, "
                            "Presentation, Midterm, or Final."
                        ),
                    }
                )

                continue

            success, message = update_marks(
                roll_no=roll_no,
                marks=marks,
                column=command_column,
            )

            results.append(
                {
                    "roll_no": roll_no,
                    "marks": marks,
                    "column": command_column,
                    "updated": success,
                    "error": not success,
                    "message": message,
                }
            )

            if success:
                total_updated += 1

        if (
            total_updated
            == len(results)
            and results
        ):

            message = (
                f"Successfully updated "
                f"{total_updated} marks entries."
            )

            success = True

        elif total_updated > 0:

            message = (
                f"Updated {total_updated} "
                f"marks entries. "
                "Some entries could not be updated."
            )

            success = False

        else:

            message = (
                results[0]["message"]
                if len(results) == 1
                else "No marks entries were updated."
            )

            success = False

        return {
            "success": success,
            "message": message,
            "text": text,
            "multi": True,
            "updated": total_updated > 0,
            "updated_count": total_updated,
            "error": not success,
            "selected_column": (
                dashboard_column
                or result.get("column")
            ),
            "commands": commands,
            "results": results,
        }

    # -----------------------------------------------------
    # SINGLE MARK COMMAND
    # -----------------------------------------------------

    if result_type == "marks":

        roll_no = result.get(
            "roll_no"
        )

        marks = result.get(
            "marks"
        )

        # Voice explicit column first.
        # Dashboard selected column second.
        selected_column = (
            result.get("column")
            or get_current_column()
        )

        if not selected_column:

            message = (
                "Which assessment should I update? "
                "Please select a column or say Quiz, "
                "Assignment, Test, Presentation, "
                "Midterm, or Final."
            )

            return {
                "success": False,
                "message": message,
                "text": text,
                "updated": False,
                "error": True,
                "selected_column": None,
                "results": [
                    {
                        "roll_no": roll_no,
                        "marks": marks,
                        "column": None,
                        "updated": False,
                        "error": True,
                        "message": message,
                    }
                ],
            }

        success, message = update_marks(
            roll_no=roll_no,
            marks=marks,
            column=selected_column,
        )

        return {
            "success": success,
            "message": message,
            "text": text,
            "updated": success,
            "error": not success,
            "selected_column": selected_column,
            "results": [
                {
                    "roll_no": roll_no,
                    "marks": marks,
                    "column": selected_column,
                    "updated": success,
                    "error": not success,
                    "message": message,
                }
            ],
        }

    # -----------------------------------------------------
    # FALLBACK
    # -----------------------------------------------------

    return {
        "success": False,
        "message": result.get(
            "message",
            "Command not recognized.",
        ),
        "text": text,
        "updated": False,
        "error": True,
    }


# =========================================================
# STUDENTS
# =========================================================

@router.get(
    "/students"
)
def get_students():

    try:
        return read_students()

    except Exception as exc:

        return {
            "error": str(exc)
        }


# =========================================================
# DOWNLOAD MAIN EXCEL
# =========================================================

@router.get(
    "/download-excel"
)
def download_excel():

    from backend.config import EXCEL_FILE

    if not EXCEL_FILE.exists():

        raise fastapi.HTTPException(
            status_code=404,
            detail="Marks Excel file not found.",
        )

    return FileResponse(
        path=EXCEL_FILE,
        media_type=(
            "application/"
            "vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        filename="final_student_marks.xlsx",
    )


# =========================================================
# MANUAL COLUMN SELECTION
# =========================================================

@router.post(
    "/set-column"
)
def set_column(
    payload: SetColumnRequest,
):

    raw_column = (
        payload.column or ""
    ).strip()

    # Empty = unlock
    if not raw_column:

        clear_current_column()

        return {
            "success": True,
            "message": "Column unlocked.",
            "selected_column": None,
        }

    # Let parser normalize aliases.
    result = parse_voice_command(
        f"select {raw_column}"
    )

    selected_column = result.get(
        "column"
    )

    if not selected_column:

        normalized = (
            raw_column
            .lower()
            .strip()
        )

        aliases = {
            "quize": "quiz",
            "quizzes": "quiz",

            "assign": "assignment",
            "assigment": "assignment",

            "tests": "test",

            "present": "presentation",

            "mid": "midterm",
            "mid term": "midterm",

            "finals": "final",
            "finalterm": "final",
            "final term": "final",
        }

        selected_column = aliases.get(
            normalized,
            normalized,
        )

    valid_columns = {
        "quiz",
        "assignment",
        "test",
        "presentation",
        "midterm",
        "final",
    }

    if selected_column not in valid_columns:

        clear_current_column()

        return {
            "success": False,
            "error": True,
            "message": (
                "Invalid column. Please select "
                "Quiz, Assignment, Test, "
                "Presentation, Midterm, or Final."
            ),
            "selected_column": None,
        }

    set_current_column(
        selected_column
    )

    display_name = (
        "Final Term"
        if selected_column == "final"
        else selected_column.title()
    )

    return {
        "success": True,
        "message": (
            f"Column selected: "
            f"{display_name}. "
            "Now say the roll number and marks."
        ),
        "text": raw_column,
        "selected_column": selected_column,
    }


# =========================================================
# TEXT VOICE COMMAND
# =========================================================

@router.post(
    "/voice-command"
)
def voice_command(
    payload: VoiceCommandRequest,
):

    text = (
        payload.text or ""
    ).strip()

    result = parse_voice_command(
        text
    )

    return _build_response_for_result(
        text,
        result,
    )


# =========================================================
# DIRECT LISTEN
# =========================================================

@router.post(
    "/listen"
)
def listen_command():

    text = listen_and_transcribe()

    result = parse_voice_command(
        text
    )

    return _build_response_for_result(
        text,
        result,
    )


# =========================================================
# AUDIO TRANSCRIPTION
# =========================================================

@router.post(
    "/transcribe-audio"
)
async def transcribe_audio(
    audio: UploadFile = File(...),
):

    upload_path = (
        Path("temp_audio")
        / "browser_voice.webm"
    )

    upload_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    try:

        upload_path.write_bytes(
            await audio.read()
        )

        text = speech_to_text(
            str(upload_path)
        )

        return {
            "text": text
        }

    finally:

        upload_path.unlink(
            missing_ok=True
        )