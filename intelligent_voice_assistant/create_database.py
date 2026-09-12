from database import Base, engine
from models import Teacher, Subject, Student, Mark

Base.metadata.create_all(bind=engine)

print("Database created successfully!")