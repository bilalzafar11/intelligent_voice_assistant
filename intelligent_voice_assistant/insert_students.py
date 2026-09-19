from database import Base, SessionLocal, engine
from models import Mark, Student

db = SessionLocal()

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

# Example names - replace these with your real student names when ready.
STUDENT_NAMES = {
    "1st Year": [
        "Ahmed Raza", "Ayesha Khan", "Ali Hassan", "Hira Ali",
        "Usman Ahmed", "Maham Noor", "Saad Khan", "Fatima Ali",
        "Bilal Raza", "Sara Ahmed",
    ],
    "2nd Year": [
        "Hamza Shah", "Zainab Khan", "Hassan Raza", "Areeba Ali",
        "Danish Ahmed", "Laiba Noor", "Talha Khan", "Iqra Shah",
        "Abdullah Ali", "Minal Ahmed",
    ],
    "3rd Year": [
        "Huzaifa Raza", "Maryam Khan", "Usman Shah", "Anaya Ali",
        "Rayyan Ahmed", "Eman Noor", "Saif Khan", "Alina Raza",
        "Ahmad Hassan", "Sana Ali",
    ],
    "4th Year": [
        "Hamza Raza", "Ayesha Shah", "Bilal Khan", "Hafsa Ali",
        "Owais Ahmed", "Maham Khan", "Shahzaib Raza", "Saira Noor",
        "Fahad Ali", "Zoya Ahmed",
    ],
}

for year in YEAR_PREFIXES:
    if len(STUDENT_NAMES[year]) != 10:
        raise ValueError(f"{year} must contain exactly 10 student names.")

db.query(Mark).delete(synchronize_session=False)
db.commit()

Student.__table__.drop(bind=engine, checkfirst=True)
Student.__table__.create(bind=engine, checkfirst=True)

students = []

for year, semester in batches:
    prefix = YEAR_PREFIXES[year]

    for roll_no in range(1, 11):
        students.append(
            Student(
                roll_no=f"{prefix}-{roll_no:02d}",
                name=STUDENT_NAMES[year][roll_no - 1],
                year=year,
                semester=semester,
            )
        )

db.add_all(students)
db.commit()

print("Students added successfully!")
print(f"Total students added: {len(students)}")

for year in YEAR_PREFIXES:
    print(f"\n{year} ({YEAR_PREFIXES[year]})")
    for roll_no, name in enumerate(STUDENT_NAMES[year], start=1):
        print(f"{YEAR_PREFIXES[year]}-{roll_no:02d} -> {name}")

db.close()