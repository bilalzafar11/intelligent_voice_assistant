from pydantic import BaseModel
from typing import Optional


class VoiceResponse(BaseModel):
    recognized_text: str


class ParsedCommand(BaseModel):
    roll_no: str
    subject: str
    marks: int


class UpdateResponse(BaseModel):
    success: bool
    message: str


class StudentRecord(BaseModel):
    roll_no: str
    student_name: Optional[str] = None
    subject: str
    marks: int