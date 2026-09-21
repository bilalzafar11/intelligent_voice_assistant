import fastapi
from pydantic import BaseModel

from database import SessionLocal
from models import HOD, Teacher, Subject, MarksSheet


router = fastapi.APIRouter()


# =========================================================
# HOD LOGIN
# =========================================================

class HODLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def hod_login(payload: HODLoginRequest):

    db = SessionLocal()

    try:
        hod = (
            db.query(HOD)
            .filter(HOD.email == payload.email)
            .first()
        )

        if not hod:
            return {
                "success": False,
                "message": "Invalid HOD email or password."
            }

        if hod.password != payload.password:
            return {
                "success": False,
                "message": "Invalid HOD email or password."
            }

        return {
            "success": True,
            "message": "HOD login successful.",
            "hod": {
                "id": hod.id,
                "hod_id": hod.hod_id,
                "name": hod.name,
                "email": hod.email
            }
        }

    finally:
        db.close()


# =========================================================
# HOD DASHBOARD
# =========================================================

@router.get("/dashboard")
def hod_dashboard():

    db = SessionLocal()

    try:

        teachers = (
            db.query(Teacher)
            .order_by(Teacher.name.asc())
            .all()
        )

        dashboard_rows = []

        for teacher in teachers:

            subjects = (
                db.query(Subject)
                .filter(
                    Subject.teacher_id == teacher.id
                )
                .order_by(Subject.subject_name.asc())
                .all()
            )

            for subject in subjects:

                # Check whether this subject has a
                # completed/final saved sheet.
                saved_sheet = (
                    db.query(MarksSheet)
                    .filter(
                        MarksSheet.teacher_id == teacher.id,
                        MarksSheet.subject_id == subject.id,
                        MarksSheet.status == "saved"
                    )
                    .order_by(
                        MarksSheet.updated_at.desc()
                    )
                    .first()
                )

                dashboard_rows.append({
                    "teacher_id": teacher.id,
                    "teacher_name": teacher.name,
                    "teacher_email": teacher.email,

                    "subject_id": subject.id,
                    "subject_name": subject.subject_name,
                    "semester": subject.semester,
                    "year": subject.year,

                    "final_sheet_done": saved_sheet is not None,

                    "sheet_id": (
                        saved_sheet.id
                        if saved_sheet
                        else None
                    ),

                    "sheet_name": (
                        saved_sheet.name
                        if saved_sheet
                        else None
                    ),

                    "updated_at": (
                        saved_sheet.updated_at.isoformat()
                        if saved_sheet and saved_sheet.updated_at
                        else None
                    )
                })

        return {
            "success": True,
            "rows": dashboard_rows
        }

    finally:
        db.close()