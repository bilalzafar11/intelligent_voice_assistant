
from database import SessionLocal
from models import HOD, Subject, Teacher


TEACHERS = [
    {
        "teacher_id": "T001",
        "name": "Mr. Imran Ali",
        "email": "imran.ali@example.com",
        "password": "123456",
        "subjects": [
            ("Cybersecurity", "4th Year", 8),
            ("Database System", "2nd Year", 4),
            ("Parallel and Distributed Computing", "3rd Year", 6),
        ],
    },
    {
        "teacher_id": "T002",
        "name": "Mr. Shahzad Ali",
        "email": "shahzad.ali@example.com",
        "password": "123456",
        "subjects": [
            ("Human Computer Interaction", "4th Year", 8),
            ("Visual Programming", "2nd Year", 4),
            ("Mobile Application Development", "3rd Year", 6),
        ],
    },
    {
        "teacher_id": "T003",
        "name": "Mr. Manzar Bashir",
        "email": "manzar.bashir@example.com",
        "password": "123456",
        "subjects": [
            ("Enterprise Systems", "4th Year", 8),
            ("Object Oriented Programming Language", "1st Year", 2),
            ("Software Project Management", "3rd Year", 6),
        ],
    },
]


HODS = [
    {
        "hod_id": "H001",
        "name": "Head of Department",
        "email": "hod@example.com",
        "password": "123456",
    }
]


def seed_teachers_and_subjects():
    db = SessionLocal()

    try:
        # Rebuild the seeded subject list while keeping existing teacher records.
        db.query(Subject).delete(synchronize_session=False)

        existing_teachers = {
            teacher.teacher_id: teacher
            for teacher in db.query(Teacher).all()
        }

        for teacher_data in TEACHERS:
            teacher = existing_teachers.get(teacher_data["teacher_id"])

            if teacher is None:
                teacher = Teacher(
                    teacher_id=teacher_data["teacher_id"],
                    name=teacher_data["name"],
                    email=teacher_data["email"],
                    password=teacher_data["password"],
                )
                db.add(teacher)
            else:
                teacher.name = teacher_data["name"]
                teacher.email = teacher_data["email"]
                teacher.password = teacher_data["password"]

            db.flush()

            db.add_all(
                Subject(
                    subject_name=subject_name,
                    year=year,
                    semester=semester,
                    teacher_id=teacher.id,
                )
                for subject_name, year, semester in teacher_data["subjects"]
            )

        valid_teacher_ids = {
            teacher_data["teacher_id"] for teacher_data in TEACHERS
        }

        for teacher_id, teacher in existing_teachers.items():
            if teacher_id not in valid_teacher_ids:
                db.delete(teacher)

        # Seed / update HOD records.
        existing_hods = {
            hod.hod_id: hod
            for hod in db.query(HOD).all()
        }

        for hod_data in HODS:
            hod = existing_hods.get(hod_data["hod_id"])

            if hod is None:
                hod = HOD(
                    hod_id=hod_data["hod_id"],
                    name=hod_data["name"],
                    email=hod_data["email"],
                    password=hod_data["password"],
                )
                db.add(hod)
            else:
                hod.name = hod_data["name"]
                hod.email = hod_data["email"]
                hod.password = hod_data["password"]

        db.commit()
        print("Teachers, subjects, and HOD data seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_teachers_and_subjects()
