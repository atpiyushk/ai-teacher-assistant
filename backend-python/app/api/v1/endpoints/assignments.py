from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
import logging

from app.db.database import get_db
from app.db.models import Teacher, Classroom, Assignment, Submission, Question
from app.api.dependencies import get_current_active_teacher
from app.schemas.assignment import (
    AssignmentCreate, AssignmentUpdate, AssignmentResponse, 
    AssignmentWithStats, QuestionCreate, QuestionResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[AssignmentWithStats])
async def list_assignments(
    classroom_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """List all assignments for the current teacher"""
    query = select(Assignment).join(Classroom).where(
        Classroom.teacher_id == current_teacher.id
    )
    
    if classroom_id:
        query = query.where(Assignment.classroom_id == classroom_id)
    
    query = query.offset(skip).limit(limit).order_by(Assignment.created_at.desc())
    result = await db.execute(query)
    assignments = result.scalars().all()
    
    # Get stats for each assignment
    assignment_responses = []
    for assignment in assignments:
        # Count submissions
        submission_count_result = await db.execute(
            select(func.count(Submission.id)).where(Submission.assignment_id == assignment.id)
        )
        submission_count = submission_count_result.scalar()
        
        # Count graded submissions
        graded_count_result = await db.execute(
            select(func.count(Submission.id)).where(
                Submission.assignment_id == assignment.id,
                Submission.status == 'graded'
            )
        )
        graded_count = graded_count_result.scalar()
        
        assignment_dict = {
            **assignment.__dict__,
            "submission_count": submission_count,
            "graded_count": graded_count
        }
        assignment_responses.append(AssignmentWithStats(**assignment_dict))
    
    return assignment_responses


@router.post("/", response_model=AssignmentResponse)
async def create_assignment(
    assignment: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Create a new assignment"""
    
    # Verify classroom belongs to teacher
    classroom_result = await db.execute(
        select(Classroom).where(
            Classroom.id == assignment.classroom_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    classroom = classroom_result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Create assignment
    db_assignment = Assignment(**assignment.dict())
    db.add(db_assignment)
    await db.commit()
    await db.refresh(db_assignment)
    
    return db_assignment


@router.get("/{assignment_id}", response_model=AssignmentWithStats)
async def get_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get a specific assignment"""
    result = await db.execute(
        select(Assignment).join(Classroom).where(
            Assignment.id == assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get stats
    submission_count_result = await db.execute(
        select(func.count(Submission.id)).where(Submission.assignment_id == assignment.id)
    )
    submission_count = submission_count_result.scalar()
    
    graded_count_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.assignment_id == assignment.id,
            Submission.status == 'graded'
        )
    )
    graded_count = graded_count_result.scalar()
    
    return AssignmentWithStats(
        **assignment.__dict__,
        submission_count=submission_count,
        graded_count=graded_count
    )


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: UUID,
    assignment_update: AssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Update an assignment"""
    result = await db.execute(
        select(Assignment).join(Classroom).where(
            Assignment.id == assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Update fields
    update_data = assignment_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment, field, value)
    
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Delete an assignment"""
    result = await db.execute(
        select(Assignment).join(Classroom).where(
            Assignment.id == assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    await db.delete(assignment)
    await db.commit()
    return {"message": "Assignment deleted successfully"}


@router.post("/{assignment_id}/questions", response_model=QuestionResponse)
async def add_question(
    assignment_id: UUID,
    question: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Add a question to an assignment"""
    
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment).join(Classroom).where(
            Assignment.id == assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Create question
    db_question = Question(
        **question.dict(),
        assignment_id=assignment_id
    )
    db.add(db_question)
    await db.commit()
    await db.refresh(db_question)
    
    return db_question


@router.get("/{assignment_id}/questions", response_model=List[QuestionResponse])
async def list_questions(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """List all questions for an assignment"""
    
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment).join(Classroom).where(
            Assignment.id == assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Get questions
    result = await db.execute(
        select(Question).where(Question.assignment_id == assignment_id).order_by(Question.order)
    )
    questions = result.scalars().all()
    
    return questions