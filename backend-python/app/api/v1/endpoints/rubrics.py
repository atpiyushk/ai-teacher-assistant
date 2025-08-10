from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
import logging

from app.db.database import get_db
from app.db.models import Teacher, Assignment, Rubric, Classroom
from app.api.dependencies import get_current_active_teacher
from app.schemas.rubric import (
    RubricCreate, RubricUpdate, RubricResponse, 
    RubricWithAssignment, RubricCriterion
)
from app.services.google_classroom import GoogleClassroomService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[RubricResponse])
async def list_rubrics(
    assignment_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """List rubrics for teacher's assignments"""
    
    # Build base query - rubrics for teacher's assignments
    query = select(Rubric).join(Assignment).join(Classroom).where(
        Classroom.teacher_id == current_teacher.id
    )
    
    # Filter by assignment if specified
    if assignment_id:
        query = query.where(Assignment.id == assignment_id)
    
    query = query.offset(skip).limit(limit).order_by(Rubric.created_at.desc())
    
    result = await db.execute(query)
    rubrics = result.scalars().all()
    
    return rubrics


@router.post("/", response_model=RubricResponse)
async def create_rubric(
    rubric: RubricCreate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Create a new rubric"""
    
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment).join(Classroom).where(
            Assignment.id == rubric.assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Check if rubric already exists for this assignment
    existing_rubric_result = await db.execute(
        select(Rubric).where(Rubric.assignment_id == rubric.assignment_id)
    )
    existing_rubric = existing_rubric_result.scalar_one_or_none()
    
    if existing_rubric:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment already has a rubric. Use PATCH to update it."
        )
    
    # Calculate total points
    total_points = sum(criterion.get("points", 0) for criterion in rubric.criteria)
    
    # Create rubric
    db_rubric = Rubric(
        assignment_id=rubric.assignment_id,
        title=rubric.title,
        description=rubric.description,
        criteria=rubric.criteria,
        total_points=total_points
    )
    
    db.add(db_rubric)
    await db.commit()
    await db.refresh(db_rubric)
    
    # If assignment is linked to Google Classroom, create rubric there too
    if assignment.google_assignment_id and current_teacher.refresh_token:
        try:
            classroom_result = await db.execute(
                select(Classroom).where(Classroom.id == assignment.classroom_id)
            )
            classroom = classroom_result.scalar_one()
            
            if classroom.google_classroom_id:
                google_service = GoogleClassroomService(current_teacher.refresh_token)
                google_rubric = await google_service.create_rubric(
                    course_id=classroom.google_classroom_id,
                    coursework_id=assignment.google_assignment_id,
                    title=rubric.title,
                    criteria=rubric.criteria
                )
                
                # Store Google rubric ID
                db_rubric.google_rubric_id = google_rubric.get("id")
                await db.commit()
                
        except Exception as e:
            logger.warning(f"Failed to create rubric in Google Classroom: {e}")
    
    return db_rubric


@router.get("/{rubric_id}", response_model=RubricWithAssignment)
async def get_rubric(
    rubric_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get a specific rubric with assignment details"""
    
    result = await db.execute(
        select(Rubric, Assignment).join(Assignment).join(Classroom).where(
            Rubric.id == rubric_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    rubric_assignment = result.first()
    
    if not rubric_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubric not found"
        )
    
    rubric, assignment = rubric_assignment
    
    return RubricWithAssignment(
        **rubric.__dict__,
        assignment_title=assignment.title,
        assignment_type=assignment.assignment_type,
        assignment_max_points=assignment.max_points
    )


@router.patch("/{rubric_id}", response_model=RubricResponse)
async def update_rubric(
    rubric_id: UUID,
    rubric_update: RubricUpdate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Update a rubric"""
    
    result = await db.execute(
        select(Rubric).join(Assignment).join(Classroom).where(
            Rubric.id == rubric_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    rubric = result.scalar_one_or_none()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubric not found"
        )
    
    # Update fields
    update_data = rubric_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rubric, field, value)
    
    # Recalculate total points if criteria changed
    if "criteria" in update_data:
        rubric.total_points = sum(
            criterion.get("points", 0) for criterion in update_data["criteria"]
        )
    
    await db.commit()
    await db.refresh(rubric)
    
    # Update in Google Classroom if linked
    if rubric.google_rubric_id and current_teacher.refresh_token:
        try:
            assignment_result = await db.execute(
                select(Assignment).where(Assignment.id == rubric.assignment_id)
            )
            assignment = assignment_result.scalar_one()
            
            classroom_result = await db.execute(
                select(Classroom).where(Classroom.id == assignment.classroom_id)
            )
            classroom = classroom_result.scalar_one()
            
            if classroom.google_classroom_id and assignment.google_assignment_id:
                google_service = GoogleClassroomService(current_teacher.refresh_token)
                await google_service.update_rubric(
                    course_id=classroom.google_classroom_id,
                    coursework_id=assignment.google_assignment_id,
                    criteria=rubric.criteria
                )
                
        except Exception as e:
            logger.warning(f"Failed to update rubric in Google Classroom: {e}")
    
    return rubric


@router.delete("/{rubric_id}")
async def delete_rubric(
    rubric_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Delete a rubric"""
    
    result = await db.execute(
        select(Rubric).join(Assignment).join(Classroom).where(
            Rubric.id == rubric_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    rubric = result.scalar_one_or_none()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubric not found"
        )
    
    # Delete from Google Classroom if linked
    if rubric.google_rubric_id and current_teacher.refresh_token:
        try:
            assignment_result = await db.execute(
                select(Assignment).where(Assignment.id == rubric.assignment_id)
            )
            assignment = assignment_result.scalar_one()
            
            classroom_result = await db.execute(
                select(Classroom).where(Classroom.id == assignment.classroom_id)
            )
            classroom = classroom_result.scalar_one()
            
            if classroom.google_classroom_id and assignment.google_assignment_id:
                google_service = GoogleClassroomService(current_teacher.refresh_token)
                await google_service.delete_rubric(
                    course_id=classroom.google_classroom_id,
                    coursework_id=assignment.google_assignment_id
                )
                
        except Exception as e:
            logger.warning(f"Failed to delete rubric from Google Classroom: {e}")
    
    await db.delete(rubric)
    await db.commit()
    
    return {"message": "Rubric deleted successfully"}


@router.post("/{rubric_id}/sync")
async def sync_rubric_with_google(
    rubric_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Sync a specific rubric with Google Classroom"""
    
    if not current_teacher.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication required. Please re-authenticate."
        )
    
    result = await db.execute(
        select(Rubric).join(Assignment).join(Classroom).where(
            Rubric.id == rubric_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    rubric = result.scalar_one_or_none()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubric not found"
        )
    
    # Get assignment and classroom details
    assignment_result = await db.execute(
        select(Assignment).where(Assignment.id == rubric.assignment_id)
    )
    assignment = assignment_result.scalar_one()
    
    classroom_result = await db.execute(
        select(Classroom).where(Classroom.id == assignment.classroom_id)
    )
    classroom = classroom_result.scalar_one()
    
    if not classroom.google_classroom_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Classroom is not linked to Google Classroom"
        )
    
    if not assignment.google_assignment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment is not linked to Google Classroom"
        )
    
    try:
        google_service = GoogleClassroomService(current_teacher.refresh_token)
        
        if rubric.google_rubric_id:
            # Update existing rubric
            google_rubric = await google_service.update_rubric(
                course_id=classroom.google_classroom_id,
                coursework_id=assignment.google_assignment_id,
                criteria=rubric.criteria
            )
        else:
            # Create new rubric
            google_rubric = await google_service.create_rubric(
                course_id=classroom.google_classroom_id,
                coursework_id=assignment.google_assignment_id,
                title=rubric.title,
                criteria=rubric.criteria
            )
            
            # Store Google rubric ID
            rubric.google_rubric_id = google_rubric.get("id")
            await db.commit()
        
        return {
            "message": "Rubric synced successfully with Google Classroom",
            "google_rubric_id": google_rubric.get("id")
        }
        
    except Exception as e:
        logger.error(f"Rubric sync failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )