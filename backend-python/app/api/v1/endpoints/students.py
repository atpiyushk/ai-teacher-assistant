from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
import logging

from app.db.database import get_db
from app.db.models import Teacher, Student, Classroom, Enrollment, Submission, Assignment
from app.api.dependencies import get_current_active_teacher
from app.schemas.student import StudentResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[StudentResponse])
async def list_students(
    classroom_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """List students enrolled in teacher's classrooms"""
    
    # Build base query - students in teacher's classrooms
    query = select(Student).join(Enrollment).join(Classroom).where(
        Classroom.teacher_id == current_teacher.id
    )
    
    # Filter by classroom if specified
    if classroom_id:
        query = query.where(Classroom.id == classroom_id)
    
    query = query.distinct().offset(skip).limit(limit).order_by(Student.name)
    
    result = await db.execute(query)
    students = result.scalars().all()
    
    return students


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get a specific student (only if enrolled in teacher's classroom)"""
    
    result = await db.execute(
        select(Student).join(Enrollment).join(Classroom).where(
            Student.id == student_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    return student


@router.get("/{student_id}/submissions")
async def get_student_submissions(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get all submissions for a student (teacher view)"""
    
    # Verify student is in teacher's classroom
    result = await db.execute(
        select(Student).join(Enrollment).join(Classroom).where(
            Student.id == student_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Get submissions with assignment details
    submissions_result = await db.execute(
        select(Submission, Assignment)
        .select_from(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
            Submission.student_id == student_id,
            Classroom.teacher_id == current_teacher.id
        )
        .order_by(Submission.submitted_at.desc())
    )
    
    submissions_data = submissions_result.all()
    
    # Format response
    submissions = []
    for submission, assignment in submissions_data:
        submissions.append({
            "id": str(submission.id),
            "assignment_id": str(assignment.id),
            "assignment_title": assignment.title,
            "assignment_type": assignment.assignment_type,
            "max_points": assignment.max_points,
            "status": submission.status,
            "submitted_at": submission.submitted_at,
            "total_score": submission.total_score,
            "feedback": submission.feedback,
            "ai_feedback": submission.ai_feedback,
            "graded_at": submission.graded_at
        })
    
    return {
        "student_id": str(student_id),
        "student_name": student.name,
        "student_email": student.email,
        "submissions": submissions
    }


# Student-facing endpoints (no teacher authentication required)

@router.get("/feedback/{student_email}")
async def get_student_feedback_by_email(
    student_email: str,
    assignment_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get feedback for a student by email (student-facing endpoint)"""
    
    # Find student by email
    student_result = await db.execute(
        select(Student).where(Student.email == student_email)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Build query for submissions
    query = (
        select(Submission, Assignment, Classroom)
        .select_from(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(Submission.student_id == student.id)
        .where(Submission.status == "graded")  # Only show graded submissions
    )
    
    if assignment_id:
        query = query.where(Assignment.id == assignment_id)
    
    query = query.order_by(Submission.graded_at.desc())
    
    result = await db.execute(query)
    submissions_data = result.all()
    
    # Format response for student
    feedback_list = []
    for submission, assignment, classroom in submissions_data:
        feedback_item = {
            "assignment": {
                "id": str(assignment.id),
                "title": assignment.title,
                "description": assignment.description,
                "max_points": assignment.max_points,
                "assignment_type": assignment.assignment_type
            },
            "classroom": {
                "id": str(classroom.id),
                "name": classroom.name,
                "subject": classroom.subject
            },
            "submission": {
                "id": str(submission.id),
                "submitted_at": submission.submitted_at,
                "graded_at": submission.graded_at,
                "total_score": submission.total_score,
                "percentage": round((submission.total_score / assignment.max_points) * 100, 1) if submission.total_score and assignment.max_points else None
            },
            "feedback": {
                "teacher_feedback": submission.feedback,
                "ai_feedback": submission.ai_feedback,
                "grade": f"{submission.total_score}/{assignment.max_points}" if submission.total_score is not None else "Not graded"
            }
        }
        feedback_list.append(feedback_item)
    
    return {
        "student": {
            "name": student.name,
            "email": student.email
        },
        "feedback": feedback_list,
        "total_assignments": len(feedback_list)
    }


@router.get("/feedback/{student_email}/assignment/{assignment_id}")
async def get_student_assignment_feedback(
    student_email: str,
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed feedback for a specific assignment (student-facing)"""
    
    # Find student and submission
    result = await db.execute(
        select(Submission, Assignment, Classroom, Student)
        .select_from(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .join(Student, Submission.student_id == Student.id)
        .where(
            Student.email == student_email,
            Assignment.id == assignment_id,
            Submission.status == "graded"
        )
    )
    
    submission_data = result.first()
    
    if not submission_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graded submission not found for this assignment"
        )
    
    submission, assignment, classroom, student = submission_data
    
    # Detailed feedback response
    return {
        "assignment": {
            "id": str(assignment.id),
            "title": assignment.title,
            "description": assignment.description,
            "instructions": assignment.instructions,
            "max_points": assignment.max_points,
            "assignment_type": assignment.assignment_type,
            "due_date": assignment.due_date
        },
        "classroom": {
            "name": classroom.name,
            "subject": classroom.subject,
            "section": classroom.section
        },
        "student": {
            "name": student.name,
            "email": student.email
        },
        "submission": {
            "id": str(submission.id),
            "submitted_at": submission.submitted_at,
            "graded_at": submission.graded_at,
            "status": submission.status
        },
        "grade": {
            "score": submission.total_score,
            "max_points": assignment.max_points,
            "percentage": round((submission.total_score / assignment.max_points) * 100, 1) if submission.total_score and assignment.max_points else None,
            "letter_grade": get_letter_grade(submission.total_score, assignment.max_points) if submission.total_score and assignment.max_points else None
        },
        "feedback": {
            "teacher_feedback": submission.feedback,
            "ai_feedback": submission.ai_feedback,
            "strengths": submission.ai_feedback.get("strengths", []) if submission.ai_feedback else [],
            "improvements": submission.ai_feedback.get("improvements", []) if submission.ai_feedback else [],
            "detailed_scores": submission.ai_feedback.get("detailed_scores", {}) if submission.ai_feedback else {}
        }
    }


def get_letter_grade(score: float, max_points: float) -> str:
    """Convert numerical score to letter grade"""
    if not score or not max_points:
        return "N/A"
    
    percentage = (score / max_points) * 100
    
    if percentage >= 97:
        return "A+"
    elif percentage >= 93:
        return "A"
    elif percentage >= 90:
        return "A-"
    elif percentage >= 87:
        return "B+"
    elif percentage >= 83:
        return "B"
    elif percentage >= 80:
        return "B-"
    elif percentage >= 77:
        return "C+"
    elif percentage >= 73:
        return "C"
    elif percentage >= 70:
        return "C-"
    elif percentage >= 67:
        return "D+"
    elif percentage >= 63:
        return "D"
    elif percentage >= 60:
        return "D-"
    else:
        return "F"