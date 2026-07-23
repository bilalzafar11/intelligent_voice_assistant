from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = PROJECT_ROOT

DATABASE_DIR = BASE_DIR / "database"
UPLOAD_DIR = BASE_DIR / "temp_audio"

EXCEL_FILE = DATABASE_DIR / "student_marks.xlsx"

WHISPER_MODEL = "small"

API_TITLE = "Intelligent Voice Assistant API"
API_VERSION = "1.0.0"