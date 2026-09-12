from database import SessionLocal
from models import Teacher, Subject, Student

db = SessionLocal()

# =========================
# 3 Teachers
# =========================

teacher1 = Teacher(
    teacher_id="T001",
    name="Sir Imran",
    email="imran@example.com",
    password="123456"
)

teacher2 = Teacher(
    teacher_id="T002",
    name="Ma'am Fatima",
    email="fatima@example.com",
    password="123456"
)

teacher3 = Teacher(
    teacher_id="T003",
    name="Sir Manzar",
    email="manzar@example.com",
    password="123456"
)

db.add_all([teacher1, teacher2, teacher3])
db.commit()

# =========================
# Subjects
# =========================

subjects = [
    Subject(
        subject_name="Database Systems",
        semester=4,
        year="2nd Year",
        teacher_id=teacher1.id
    ),
    Subject(
        subject_name="Cyber Security",
        semester=8,
        year="4th Year",
        teacher_id=teacher1.id
    ),
    Subject(
        subject_name="Software Engineering",
        semester=7,
        year="4th Year",
        teacher_id=teacher1.id
    ),

    Subject(
        subject_name="Computer Networking",
        semester=3,
        year="2nd Year",
        teacher_id=teacher2.id
    ),
    Subject(
        subject_name="Data Science",
        semester=6,
        year="3rd Year",
        teacher_id=teacher2.id
    ),
    Subject(
        subject_name="Artificial Intelligence",
        semester=5,
        year="3rd Year",
        teacher_id=teacher2.id
    ),

    Subject(
        subject_name="Enterprise Systems",
        semester=8,
        year="4th Year",
        teacher_id=teacher3.id
    ),
    Subject(
        subject_name="Web Engineering",
        semester=7,
        year="4th Year",
        teacher_id=teacher3.id
    ),
    Subject(
        subject_name="Cloud Computing",
        semester=6,
        year="3rd Year",
        teacher_id=teacher3.id
    )
]

db.add_all(subjects)
db.commit()

print("Teachers and subjects added successfully!")

db.close()