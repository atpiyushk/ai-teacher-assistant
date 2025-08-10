from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class ClassroomBase(BaseModel):
    name: str
    section: Optional[str] = None
    subject: Optional[str] = None
    room: Optional[str] = None
    sync_enabled: bool = True


class ClassroomCreate(ClassroomBase):
    google_classroom_id: Optional[str] = None


class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    section: Optional[str] = None
    subject: Optional[str] = None
    room: Optional[str] = None
    sync_enabled: Optional[bool] = None


class ClassroomResponse(ClassroomBase):
    id: UUID
    teacher_id: UUID
    google_classroom_id: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ClassroomWithStats(ClassroomResponse):
    student_count: int = 0
    assignment_count: int = 0