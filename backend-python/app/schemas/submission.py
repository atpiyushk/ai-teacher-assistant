from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class SubmissionFileBase(BaseModel):
    filename: str
    file_type: str
    file_size: int


class SubmissionFileResponse(SubmissionFileBase):
    id: UUID
    submission_id: UUID
    file_path: str
    ocr_status: str
    ocr_result: Optional[Dict[str, Any]] = None
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    file_id: UUID
    filename: str
    file_size: int
    status: str
    ocr_status: str


class SubmissionBase(BaseModel):
    status: str = "pending"
    feedback: Optional[str] = None
    total_score: Optional[float] = None
    student_answers: Optional[Dict[str, Any]] = None


class SubmissionCreate(BaseModel):
    assignment_id: UUID
    student_email: EmailStr


class SubmissionUpdate(BaseModel):
    status: Optional[str] = None
    feedback: Optional[str] = None
    total_score: Optional[float] = None
    ai_feedback: Optional[Dict[str, Any]] = None


class SubmissionResponse(SubmissionBase):
    id: UUID
    assignment_id: UUID
    student_id: UUID
    google_submission_id: Optional[str] = None
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None
    ai_feedback: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SubmissionWithFiles(SubmissionResponse):
    files: List[SubmissionFileResponse] = []
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    student_google_id: Optional[str] = None