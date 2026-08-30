import fastapi # type: ignore
from pydantic import BaseModel

try:
    from backend.services.excel_service import read_students, update_marks
    from backend.services.parser_service import parse_voice_command
    from backend.services.session_service import get_current_column
    from backend.services.speech_service import listen_and_transcribe
except ModuleNotFoundError:  # pragma: no cover
    from services.excel_service import read_students, update_marks
    from services.parser_service import parse_voice_command
    from services.session_service import get_current_column
    from services.speech_service import listen_and_transcribe

router = fastapi.APIRouter()


class VoiceCommandRequest(BaseModel):
    text: str


def _build_response_for_result(text: str, result: dict):
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

    if result.get("multi") and isinstance(result.get("commands"), list):
        total_updated = 0
        selected_column = result.get("column") or get_current_column()
        results = []

        for command in result["commands"]:
            if command.get("type") == "column":
                selected_column = command.get("column") or selected_column
                continue
            if command.get("type") == "marks":
                success, msg = update_marks(command["roll_no"], command["marks"])
                results.append({
                    "roll_no": command["roll_no"],
                    "marks": command["marks"],
                    "updated": success,
                    "message": msg,
                })
                if success:
                    total_updated += 1

        response = {
            "message": f"Updated {total_updated} marks entries." if total_updated else "No marks entries were updated.",
            "text": text,
            "multi": True,
            "commands": result["commands"],
            "updated_count": total_updated,
            "updated": total_updated > 0,
            "selected_column": selected_column,
            "results": results,
        }

        if total_updated == 0 and result["commands"]:
            response["message"] = "Command processed, but no marks were updated."
        return response

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
    return _build_response_for_result(text, result)


@router.post("/listen")
def listen_command():
    text = listen_and_transcribe()
    result = parse_voice_command(text)
    return _build_response_for_result(text, result)
