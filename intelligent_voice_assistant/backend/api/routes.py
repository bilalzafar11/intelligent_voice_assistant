import fastapi # type: ignore
from pydantic import BaseModel

try:
    from backend.services.excel_service import read_students, update_marks
    from backend.services.parser_service import parse_voice_command
    from backend.services.session_service import get_current_column, set_current_column
    from backend.services.speech_service import listen_and_transcribe
except ModuleNotFoundError:  # pragma: no cover
    from services.excel_service import read_students, update_marks
    from services.parser_service import parse_voice_command
    from services.session_service import get_current_column, set_current_column
    from services.speech_service import listen_and_transcribe

router = fastapi.APIRouter()


class VoiceCommandRequest(BaseModel):
    text: str


class SetColumnRequest(BaseModel):
    column: str


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
                command_column = command.get("column")
                if command_column:
                    set_current_column(command_column)
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

        if total_updated == 0 and results:
            response["message"] = " ".join(
                item["message"] for item in results if not item["updated"]
            )
        elif total_updated < len(results):
            failed_messages = [
                item["message"] for item in results if not item["updated"]
            ]
            response["message"] = (
                f"Updated {total_updated} marks entries. "
                + " ".join(failed_messages)
            )
        return response

    if result["type"] == "marks":
        success, msg = update_marks(result["roll_no"], result["marks"])
        selected_column = result.get("column") or get_current_column()
        return {
            "message": "Marks Updated Successfully." if success else f"{msg}. Select a column first if needed.",
            "text": text,
            "updated": success,
            "selected_column": selected_column,
            "results": [{
                "roll_no": result["roll_no"],
                "marks": result["marks"],
                "updated": success,
                "message": msg,
            }],
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


@router.post("/set-column")
def set_column(payload: SetColumnRequest):
    raw_column = (payload.column or "").strip()
    if not raw_column:
        return {"message": "No column selected.", "selected_column": None}

    result = parse_voice_command(f"select {raw_column}")
    selected_column = result.get("column") or raw_column.lower()
    set_current_column(selected_column)

    return {
        "message": f"Column selected: {selected_column}. Now say the roll number and marks.",
        "text": raw_column,
        "selected_column": selected_column,
    }


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
