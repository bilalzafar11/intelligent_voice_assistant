import fastapi
from pydantic import BaseModel

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database import SessionLocal
from models import HOD, Teacher, Subject, Student
from backend.services.excel_service import read_students
from backend.services.excel_service import read_students

router = fastapi.APIRouter()


def _get_mark_value(student: dict, *names: str):
    normalized_values = {
        "".join(character for character in str(key).lower() if character.isalnum()): value
        for key, value in student.items()
    }

    for name in names:
        value = normalized_values.get(
            "".join(character for character in name.lower() if character.isalnum())
        )
        if value is not None:
            return value

    return 0


def _excel_student_for_roll(excel_students: dict, roll_no: str):
    exact = excel_students.get(str(roll_no))
    if exact is not None:
        return exact

    suffix = str(roll_no).rsplit("-", 1)[-1].lstrip("0") or "0"
    return excel_students.get(suffix, {})


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def common_login(payload: LoginRequest):
    """
    Common login endpoint for both Teacher and HOD.

    Teacher:
        returns role = "teacher" and teacher data.

    HOD:
        returns role = "hod" and HOD data.
    """

    db = SessionLocal()

    try:
        # =========================================================
        # 1. CHECK HOD LOGIN
        # =========================================================

        hod = (
            db.query(HOD)
            .filter(HOD.email == payload.email)
            .first()
        )

        if hod and hod.password == payload.password:
            return {
                "success": True,
                "role": "hod",
                "message": "HOD login successful.",
                "hod": {
                    "id": hod.id,
                    "hod_id": hod.hod_id,
                    "name": hod.name,
                    "email": hod.email
                }
            }

        # =========================================================
        # 2. CHECK TEACHER LOGIN
        # =========================================================

        teacher = (
            db.query(Teacher)
            .filter(Teacher.email == payload.email)
            .first()
        )

        if teacher and teacher.password == payload.password:
            return {
                "success": True,
                "role": "teacher",
                "message": "Login successful.",
                "teacher": {
                    "id": teacher.id,
                    "teacher_id": teacher.teacher_id,
                    "name": teacher.name,
                    "email": teacher.email
                }
            }

        # =========================================================
        # 3. INVALID LOGIN
        # =========================================================

        return {
            "success": False,
            "message": "Invalid email or password."
        }

    finally:
        db.close()


@router.get("/subjects/{teacher_id}")
def get_teacher_subjects(teacher_id: int):
    db = SessionLocal()

    try:
        teacher = (
            db.query(Teacher)
            .filter(Teacher.id == teacher_id)
            .first()
        )

        if not teacher:
            return {
                "success": False,
                "message": "Teacher not found."
            }

        return {
            "success": True,
            "teacher": {
                "id": teacher.id,
                "name": teacher.name
            },
            "subjects": [
                {
                    "id": subject.id,
                    "subject_name": subject.subject_name,
                    "year": subject.year,
                    "semester": subject.semester
                }
                for subject in teacher.subjects
            ]
        }

    finally:
        db.close()


@router.get("/students/{subject_id}")
def get_subject_students(subject_id: int):
    db = SessionLocal()

    try:
        subject = (
            db.query(Subject)
            .filter(Subject.id == subject_id)
            .first()
        )

        if not subject:
            return {
                "success": False,
                "message": "Subject not found."
            }

        students = (
            db.query(Student)
            .filter(
                Student.year == subject.year,
                Student.semester == subject.semester
            )
            .all()
        )

        excel_students = {
            str(student.get("rollNo")): student
            for student in read_students()
            if student.get("rollNo") is not None
        }

        return {
            "success": True,
            "subject": {
                "id": subject.id,
                "subject_name": subject.subject_name,
                "year": subject.year,
                "semester": subject.semester
            },
            "students": [
                {
                    "id": student.id,
                    "roll_no": student.roll_no,
                    "name": student.name,
                    "quiz": _get_mark_value(
                        _excel_student_for_roll(excel_students, student.roll_no),
                        "quiz",
                        "quize",
                        "quizzes",
                    ),
                    "test": _get_mark_value(
                        _excel_student_for_roll(excel_students, student.roll_no),
                        "test",
                    ),
                    "assignment": _get_mark_value(
                        _excel_student_for_roll(excel_students, student.roll_no),
                        "assignment",
                    ),
                    "presentation": _get_mark_value(
                        _excel_student_for_roll(excel_students, student.roll_no),
                        "presentation",
                    ),
                    "midterm": _get_mark_value(
                        _excel_student_for_roll(excel_students, student.roll_no),
                        "midterm",
                    ),
                    "final": _get_mark_value(
                        _excel_student_for_roll(excel_students, student.roll_no),
                        "finalterm",
                        "final term",
                        "final",
                    ),
                }
                for student in students
            ]
        }

    finally:
        db.close()
