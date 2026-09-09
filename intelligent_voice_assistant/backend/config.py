from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = PROJECT_ROOT

DATABASE_DIR = BASE_DIR / "database"
UPLOAD_DIR = BASE_DIR / "temp_audio"

EXCEL_FILE = DATABASE_DIR / "student_marks.xlsx"

WHISPER_MODEL = "large-v3"

API_TITLE = "Intelligent Voice Assistant API"
API_VERSION = "1.0.0"

MARKS_LIMITS = {
	"assignment": (1, 10),
	"test": (1, 10),
	"midterm": (1, 30),
	"final": (1, 40),
	"finalterm": (1, 40),
}