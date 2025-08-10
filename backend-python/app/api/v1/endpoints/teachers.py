from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.db.models import Teacher, Classroom, Enrollment, Assignment, Submission
from app.api.dependencies import get_current_active_teacher
from app.schemas.teacher import TeacherResponse, TeacherUpdate, TeacherWithStats

router = APIRouter()


@router.get("/me", response_model=TeacherWithStats)
async def get_current_teacher_info(
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get current teacher information with statistics"""
    
    # Count classrooms
    classroom_count_result = await db.execute(
        select(func.count(Classroom.id)).where(Classroom.teacher_id == current_teacher.id)
    )
    classroom_count = classroom_count_result.scalar()
    
    # Count total students across all classrooms
    student_count_result = await db.execute(
        select(func.count(Enrollment.id.distinct())).
        join(Classroom, Enrollment.classroom_id == Classroom.id).
        where(Classroom.teacher_id == current_teacher.id)
    )
    student_count = student_count_result.scalar()
    
    # Count assignments
    assignment_count_result = await db.execute(
        select(func.count(Assignment.id)).
        join(Classroom, Assignment.classroom_id == Classroom.id).
        where(Classroom.teacher_id == current_teacher.id)
    )
    assignment_count = assignment_count_result.scalar()
    
    # Count pending submissions
    pending_submissions_result = await db.execute(
        select(func.count(Submission.id)).
        join(Assignment, Submission.assignment_id == Assignment.id).
        join(Classroom, Assignment.classroom_id == Classroom.id).
        where(
            Classroom.teacher_id == current_teacher.id,
            Submission.status.in_(['pending', 'processing'])
        )
    )
    pending_submissions = pending_submissions_result.scalar()
    
    return TeacherWithStats(
        **current_teacher.__dict__,
        total_classrooms=classroom_count,
        total_students=student_count,
        total_assignments=assignment_count,
        pending_submissions=pending_submissions
    )


@router.patch("/me", response_model=TeacherResponse)
async def update_current_teacher(
    teacher_update: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Update current teacher information"""
    
    # Update fields
    update_data = teacher_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_teacher, field, value)
    
    await db.commit()
    await db.refresh(current_teacher)
    return current_teacher


@router.delete("/me")
async def delete_current_teacher(
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Delete current teacher account"""
    # Note: This will cascade delete all related data due to foreign key constraints
    await db.delete(current_teacher)
    await db.commit()
    return {"message": "Account deleted successfully"}