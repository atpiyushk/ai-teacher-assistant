from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class QuestionBase(BaseModel):
    question_text: str
    question_type: str
    points: float = 1.0
    correct_answer: Optional[Dict[str, Any]] = None
    grading_criteria: Optional[str] = None
    order: int = 0


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    points: Optional[float] = None
    correct_answer: Optional[Dict[str, Any]] = None
    grading_criteria: Optional[str] = None
    order: Optional[int] = None


class QuestionResponse(QuestionBase):
    id: UUID
    assignment_id: UUID
    
    class Config:
        from_attributes = True


class AssignmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    max_points: float = 100
    assignment_type: Optional[str] = None
    grading_criteria: Optional[Dict[str, Any]] = None
    auto_grade: bool = False


class AssignmentCreate(AssignmentBase):
    classroom_id: UUID
    google_assignment_id: Optional[str] = None


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    max_points: Optional[float] = None
    assignment_type: Optional[str] = None
    grading_criteria: Optional[Dict[str, Any]] = None
    auto_grade: Optional[bool] = None


class AssignmentResponse(AssignmentBase):
    id: UUID
    classroom_id: UUID
    google_assignment_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AssignmentWithStats(AssignmentResponse):
    submission_count: int = 0
    graded_count: int = 0