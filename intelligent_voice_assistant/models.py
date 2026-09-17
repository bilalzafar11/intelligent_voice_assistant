from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime  # type: ignore[import-not-found]
from sqlalchemy.orm import relationship  # type: ignore[import-not-found]
from datetime import datetime

from database import Base


# =========================
# Teacher Table
# =========================
class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)

    subjects = relationship("Subject", back_populates="teacher")


# =========================
# Subject Table
# =========================
class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    subject_name = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)
    year = Column(String, nullable=False)

    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)

    teacher = relationship("Teacher", back_populates="subjects")
    marks = relationship("Mark", back_populates="subject")


# =========================
# Student Table
# =========================
class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String, nullable=False)
    name = Column(String, nullable=False)
    year = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)

    marks = relationship("Mark", back_populates="student")


# =========================
# Marks Table
# =========================
class Mark(Base):
    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    assessment = Column(String, nullable=False)
    marks = Column(Integer, nullable=False)

    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject", back_populates="marks")


class MarksSheet(Base):
    __tablename__ = "marks_sheets"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="draft", index=True)
    rows_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    teacher = relationship("Teacher")
    subject = relationship("Subject")