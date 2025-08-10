from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class StudentBase(BaseModel):
    email: EmailStr
    name: str


class StudentCreate(StudentBase):
    google_id: Optional[str] = None


class StudentUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    google_id: Optional[str] = None


class StudentResponse(StudentBase):
    id: UUID
    google_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class StudentWithEnrollment(StudentResponse):
    classroom_id: UUID
    classroom_name: str
    enrolled_at: datetime