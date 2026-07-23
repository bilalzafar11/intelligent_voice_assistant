from fastapi import APIRouter
from pydantic import BaseModel

from services.excel_service import read_students, update_marks
from services.parser_service import parse_voice_command
from services.session_service import get_current_column
from services.speech_service import listen_and_transcribe

router = APIRouter()


class VoiceCommandRequest(BaseModel):
    text: str


@router.get("/students")
def get_students():
    try:
        return read_students()
    except Exception as exc:
        return {"error": str(exc)}


@router.post("/voice-command")
def voice_command(payload: VoiceCommandRequest):
    text = (payload.text or "").strip()
    result = parse_voice_command(text)

    if result["type"] == "unlock":
        return {
            "message": "Column unlocked. You can select a new column now.",
            "text": text,
        }

    if result["type"] == "column":
        return {
            "message": f"Column selected: {result['column']}. Now say the roll number and marks.",
            "text": text,
            "selected_column": result["column"],
        }

    if result["type"] == "marks":
        success, msg = update_marks(result["roll_no"], result["marks"])
        selected_column = result.get("column") or get_current_column()
        return {
            "message": msg if success else f"{msg}. Select a column first if needed.",
            "text": text,
            "updated": success,
            "selected_column": selected_column,
        }

    return {
        "message": "Command not recognized",
        "text": text,
    }


@router.post("/listen")
def listen_command():
    text = listen_and_transcribe()
    result = parse_voice_command(text)

    if result["type"] == "unlock":
        return {
            "message": "Column unlocked. You can select a new column now.",
            "text": text,
        }

    if result["type"] == "column":
        return {
            "message": f"Column selected: {result['column']}. Now say the roll number and marks.",
            "text": text,
            "selected_column": result["column"],
        }

    if result["type"] == "marks":
        success, msg = update_marks(result["roll_no"], result["marks"])
        selected_column = result.get("column") or get_current_column()
        return {
            "message": msg if success else f"{msg}. Select a column first if needed.",
            "text": text,
            "updated": success,
            "selected_column": selected_column,
        }

    return {
        "message": "Command not recognized",
        "text": text,
    }
