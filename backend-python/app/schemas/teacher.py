from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class TeacherBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class TeacherCreate(TeacherBase):
    google_id: str
    avatar_url: Optional[str] = None


class TeacherRegister(TeacherBase):
    password: str
    school: Optional[str] = None


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class TeacherResponse(TeacherBase):
    id: UUID
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TeacherWithStats(TeacherResponse):
    total_classrooms: int = 0
    total_students: int = 0
    total_assignments: int = 0
    pending_submissions: int = 0