from database import Base, SessionLocal, engine
from models import Mark, Student

db = SessionLocal()

# Students belong to a year/semester batch, not to an individual subject.
# Therefore subjects sharing a batch receive the same ten roll numbers.
batches = [
    ("1st Year", 2),
    ("2nd Year", 3),
    ("2nd Year", 4),
    ("3rd Year", 5),
    ("3rd Year", 6),
    ("4th Year", 7),
    ("4th Year", 8),
]

YEAR_PREFIXES = {
    "1st Year": "26BSIT",
    "2nd Year": "25BSIT",
    "3rd Year": "24BSIT",
    "4th Year": "23BSIT",
}

# The old database has a global unique index on roll_no. Recreate only the
# student table so the same roll numbers can exist in different batches.
db.query(Mark).delete(synchronize_session=False)
db.commit()
Student.__table__.drop(bind=engine, checkfirst=True)
Student.__table__.create(bind=engine, checkfirst=True)

students = [
    Student(
        roll_no=f"{YEAR_PREFIXES[year]}-{roll_no:02d}",
        name=f"Student {roll_no:02d}",
        year=year,
        semester=semester,
    )
    for year, semester in batches
    for roll_no in range(1, 11)
]

db.add_all(students)
db.commit()

print("Students added successfully!")
print(f"Total students added: {len(students)}")

db.close()