from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
import logging

from app.db.database import get_db
from app.db.models import Teacher, Classroom, Enrollment, Student, Assignment
from app.api.dependencies import get_current_active_teacher
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate, ClassroomResponse, ClassroomWithStats
from app.services.google_classroom import GoogleClassroomService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[ClassroomWithStats])
async def list_classrooms(
    skip: int = 0,
    limit: int = 100,
    sync_enabled: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """List all classrooms for the current teacher"""
    query = select(Classroom).where(Classroom.teacher_id == current_teacher.id)
    
    if sync_enabled is not None:
        query = query.where(Classroom.sync_enabled == sync_enabled)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    classrooms = result.scalars().all()
    
    # Get stats for each classroom
    classroom_responses = []
    for classroom in classrooms:
        # Count students
        student_count_result = await db.execute(
            select(func.count(Enrollment.id)).where(Enrollment.classroom_id == classroom.id)
        )
        student_count = student_count_result.scalar()
        
        # Count assignments
        assignment_count_result = await db.execute(
            select(func.count(Assignment.id)).where(Assignment.classroom_id == classroom.id)
        )
        assignment_count = assignment_count_result.scalar()
        
        classroom_dict = {
            **classroom.__dict__,
            "student_count": student_count,
            "assignment_count": assignment_count
        }
        classroom_responses.append(ClassroomWithStats(**classroom_dict))
    
    return classroom_responses


@router.post("/", response_model=ClassroomResponse)
async def create_classroom(
    classroom: ClassroomCreate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Create a new classroom"""
    db_classroom = Classroom(
        **classroom.dict(),
        teacher_id=current_teacher.id
    )
    db.add(db_classroom)
    await db.commit()
    await db.refresh(db_classroom)
    return db_classroom


@router.get("/{classroom_id}", response_model=ClassroomWithStats)
async def get_classroom(
    classroom_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get a specific classroom"""
    result = await db.execute(
        select(Classroom).where(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Get stats
    student_count_result = await db.execute(
        select(func.count(Enrollment.id)).where(Enrollment.classroom_id == classroom.id)
    )
    student_count = student_count_result.scalar()
    
    assignment_count_result = await db.execute(
        select(func.count(Assignment.id)).where(Assignment.classroom_id == classroom.id)
    )
    assignment_count = assignment_count_result.scalar()
    
    return ClassroomWithStats(
        **classroom.__dict__,
        student_count=student_count,
        assignment_count=assignment_count
    )


@router.patch("/{classroom_id}", response_model=ClassroomResponse)
async def update_classroom(
    classroom_id: UUID,
    classroom_update: ClassroomUpdate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Update a classroom"""
    result = await db.execute(
        select(Classroom).where(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Update fields
    update_data = classroom_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(classroom, field, value)
    
    await db.commit()
    await db.refresh(classroom)
    return classroom


@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Delete a classroom"""
    result = await db.execute(
        select(Classroom).where(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    await db.delete(classroom)
    await db.commit()
    return {"message": "Classroom deleted successfully"}


@router.post("/sync/google")
async def sync_google_classrooms(
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Sync classrooms from Google Classroom"""
    if not current_teacher.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication required. Please re-authenticate."
        )
    
    try:
        # Initialize Google Classroom service
        service = GoogleClassroomService(current_teacher.refresh_token)
        
        # Get classrooms from Google
        google_classrooms = await service.list_courses()
        
        # Sync each classroom
        synced_count = 0
        for gc in google_classrooms:
            # Check if classroom already exists
            result = await db.execute(
                select(Classroom).where(
                    Classroom.google_classroom_id == gc["id"],
                    Classroom.teacher_id == current_teacher.id
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                # Create new classroom
                new_classroom = Classroom(
                    teacher_id=current_teacher.id,
                    google_classroom_id=gc["id"],
                    name=gc["name"],
                    section=gc.get("section"),
                    subject=gc.get("descriptionHeading"),
                    room=gc.get("room"),
                    sync_enabled=True
                )
                db.add(new_classroom)
                synced_count += 1
            else:
                # Update existing classroom
                existing.name = gc["name"]
                existing.section = gc.get("section")
                existing.subject = gc.get("descriptionHeading")
                existing.room = gc.get("room")
                synced_count += 1
        
        await db.commit()
        
        return {
            "message": f"Successfully synced {synced_count} classrooms",
            "synced_count": synced_count
        }
        
    except Exception as e:
        logger.error(f"Google Classroom sync failed: {e}")
        
        # Check if it's a scope issue
        error_str = str(e)
        if "invalid_scope" in error_str or "insufficient permissions" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Please re-authenticate with Google Classroom to access Drive files. Visit /api/v1/auth/login/google/classroom to update your permissions."
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )


@router.post("/{classroom_id}/sync")
async def sync_individual_classroom(
    classroom_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Sync assignments and students for a specific classroom"""
    if not current_teacher.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication required. Please re-authenticate."
        )
    
    # Get the classroom
    result = await db.execute(
        select(Classroom).where(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    if not classroom.google_classroom_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This classroom is not linked to Google Classroom"
        )
    
    try:
        # Initialize Google Classroom service
        service = GoogleClassroomService(current_teacher.refresh_token)
        
        # Sync assignments (bidirectional)
        assignments_synced = 0
        try:
            from app.db.models import Assignment
            
            # 1. Pull assignments FROM Google Classroom
            google_assignments = await service.list_course_work(classroom.google_classroom_id)
            
            for ga in google_assignments:
                # Check if assignment already exists
                result = await db.execute(
                    select(Assignment).where(
                        Assignment.google_assignment_id == ga["id"],
                        Assignment.classroom_id == classroom.id
                    )
                )
                existing = result.scalar_one_or_none()
                
                if not existing:
                    # Create new assignment
                    new_assignment = Assignment(
                        classroom_id=classroom.id,
                        google_assignment_id=ga["id"],
                        title=ga.get("title", "Untitled Assignment"),
                        description=ga.get("description", ""),
                        assignment_type=ga.get("workType", "ASSIGNMENT"),
                        max_points=ga.get("maxPoints", 100),
                        due_date=service.parse_due_date(ga.get("dueDate")),
                        instructions=ga.get("description", "")
                    )
                    db.add(new_assignment)
                    assignments_synced += 1
                else:
                    # Update existing assignment
                    existing.title = ga.get("title", "Untitled Assignment")
                    existing.description = ga.get("description", "")
                    existing.max_points = ga.get("maxPoints", 100)
                    existing.due_date = service.parse_due_date(ga.get("dueDate"))
                    existing.instructions = ga.get("description", "")
            
            # 2. Push assignments TO Google Classroom
            # Get local assignments that don't have Google IDs
            result = await db.execute(
                select(Assignment).where(
                    Assignment.classroom_id == classroom.id,
                    Assignment.google_assignment_id.is_(None)
                )
            )
            local_assignments = result.scalars().all()
            
            for assignment in local_assignments:
                try:
                    # Create assignment in Google Classroom
                    google_assignment = await service.create_course_work(
                        course_id=classroom.google_classroom_id,
                        title=assignment.title,
                        description=assignment.description or "",
                        instructions=assignment.instructions or "",
                        due_date=assignment.due_date,
                        max_points=assignment.max_points,
                        work_type=assignment.assignment_type or "ASSIGNMENT"
                    )
                    
                    # Update local assignment with Google ID
                    assignment.google_assignment_id = google_assignment["id"]
                    assignments_synced += 1
                    logger.info(f"Pushed assignment '{assignment.title}' to Google Classroom")
                    
                except Exception as e:
                    logger.warning(f"Failed to push assignment '{assignment.title}' to Google: {e}")
                    
        except Exception as e:
            logger.warning(f"Failed to sync assignments: {e}")
        
        # Sync students
        students_synced = 0
        try:
            google_students = await service.list_students(classroom.google_classroom_id)
            
            for gs in google_students:
                # Check if student already exists
                from app.db.models import Student, Enrollment
                profile = gs.get("profile", {})
                email = profile.get("emailAddress")
                google_id = profile.get("id")
                name = profile.get("name", {}).get("fullName", "Unknown Student")
                
                # Skip if no Google ID (essential for identification)
                if not google_id:
                    continue
                
                # Find student by Google ID first, then by email if available
                student = None
                if google_id:
                    result = await db.execute(
                        select(Student).where(Student.google_id == google_id)
                    )
                    student = result.scalar_one_or_none()
                
                # If not found by Google ID and email exists, try email
                if not student and email:
                    result = await db.execute(
                        select(Student).where(Student.email == email)
                    )
                    student = result.scalar_one_or_none()
                
                if not student:
                    # Create new student
                    # Generate a placeholder email if none provided
                    student_email = email or f"student_{google_id}@noemail.local"
                    
                    student = Student(
                        google_id=google_id,
                        email=student_email,
                        name=name
                    )
                    db.add(student)
                    await db.flush()  # Get the student ID
                else:
                    # Update existing student with any new info
                    if email and student.email.endswith("@noemail.local"):
                        student.email = email
                    if name and name != "Unknown Student":
                        student.name = name
                
                # Check if enrollment exists
                result = await db.execute(
                    select(Enrollment).where(
                        Enrollment.classroom_id == classroom.id,
                        Enrollment.student_id == student.id
                    )
                )
                enrollment = result.scalar_one_or_none()
                
                if not enrollment:
                    # Create enrollment
                    enrollment = Enrollment(
                        classroom_id=classroom.id,
                        student_id=student.id
                    )
                    db.add(enrollment)
                    students_synced += 1
        except Exception as e:
            logger.warning(f"Failed to sync students: {e}")
        
        # Sync submissions
        submissions_synced = 0
        try:
            from app.db.models import Assignment, Student, Submission
            
            # Get all assignments for this classroom that have Google IDs
            result = await db.execute(
                select(Assignment).where(
                    Assignment.classroom_id == classroom.id,
                    Assignment.google_assignment_id.isnot(None)
                )
            )
            assignments = result.scalars().all()
            
            for assignment in assignments:
                try:
                    # Get submissions for this assignment from Google
                    google_submissions = await service.list_student_submissions(
                        course_id=classroom.google_classroom_id,
                        coursework_id=assignment.google_assignment_id,
                        states=["TURNED_IN", "RETURNED"]
                    )
                    
                    for gs in google_submissions:
                        submission_id = gs.get("id")
                        student_google_id = gs.get("userId")
                        state = gs.get("state")
                        
                        if not submission_id or not student_google_id:
                            continue
                        
                        # Find the student by Google ID
                        result = await db.execute(
                            select(Student).where(Student.google_id == student_google_id)
                        )
                        student = result.scalar_one_or_none()
                        
                        if not student:
                            logger.warning(f"Student with Google ID {student_google_id} not found for submission {submission_id}")
                            continue
                        
                        # Check if submission already exists
                        result = await db.execute(
                            select(Submission).where(
                                Submission.google_submission_id == submission_id
                            )
                        )
                        existing_submission = result.scalar_one_or_none()
                        
                        if not existing_submission:
                            # Create new submission
                            from datetime import datetime
                            import dateutil.parser
                            
                            submitted_at = None
                            if gs.get("creationTime"):
                                submitted_at = dateutil.parser.parse(gs.get("creationTime"))
                            
                            # Fetch the full submission details to get the actual content
                            try:
                                full_submission = await service.get_student_submission(
                                    course_id=classroom.google_classroom_id,
                                    coursework_id=assignment.google_assignment_id,
                                    submission_id=submission_id
                                )
                            except Exception as e:
                                logger.error(f"Failed to fetch full submission details for {submission_id}: {e}")
                                full_submission = gs  # Fallback to basic submission data
                            
                            # Get student answers from the full submission
                            student_answers = {}
                            if full_submission.get("shortAnswerSubmission"):
                                student_answers["type"] = "short_answer"
                                student_answers["answer"] = full_submission["shortAnswerSubmission"].get("answer", "")
                            elif full_submission.get("multipleChoiceSubmission"):
                                student_answers["type"] = "multiple_choice"
                                student_answers["answer"] = full_submission["multipleChoiceSubmission"].get("answer", "")
                            elif full_submission.get("assignmentSubmission"):
                                student_answers["type"] = "assignment"
                                attachments = full_submission["assignmentSubmission"].get("attachments", [])
                                student_answers["attachments"] = attachments
                                # Extract text from link or drive file attachments
                                text_content = []
                                for att in attachments:
                                    if att.get("link"):
                                        text_content.append(f"Link: {att['link'].get('url', '')}")
                                    elif att.get("driveFile"):
                                        text_content.append(f"Drive File: {att['driveFile'].get('title', '')}")
                                student_answers["text"] = "\n".join(text_content)
                            
                            new_submission = Submission(
                                assignment_id=assignment.id,
                                student_id=student.id,
                                google_submission_id=submission_id,
                                status="submitted" if state == "TURNED_IN" else "returned",
                                submitted_at=submitted_at,
                                total_score=full_submission.get("assignedGrade"),
                                student_answers=student_answers if student_answers else None
                            )
                            db.add(new_submission)
                            submissions_synced += 1
                            logger.info(f"Synced submission from {student.name} for {assignment.title}")
                        else:
                            # Update existing submission
                            existing_submission.status = "submitted" if state == "TURNED_IN" else "returned"
                            if gs.get("assignedGrade"):
                                existing_submission.total_score = gs.get("assignedGrade")
                            
                            # If student_answers is null, fetch the full submission details
                            if existing_submission.student_answers is None:
                                try:
                                    full_submission = await service.get_student_submission(
                                        course_id=classroom.google_classroom_id,
                                        coursework_id=assignment.google_assignment_id,
                                        submission_id=submission_id
                                    )
                                    
                                    # Get student answers from the full submission
                                    student_answers = {}
                                    if full_submission.get("shortAnswerSubmission"):
                                        student_answers["type"] = "short_answer"
                                        student_answers["answer"] = full_submission["shortAnswerSubmission"].get("answer", "")
                                    elif full_submission.get("multipleChoiceSubmission"):
                                        student_answers["type"] = "multiple_choice"
                                        student_answers["answer"] = full_submission["multipleChoiceSubmission"].get("answer", "")
                                    elif full_submission.get("assignmentSubmission"):
                                        student_answers["type"] = "assignment"
                                        attachments = full_submission["assignmentSubmission"].get("attachments", [])
                                        student_answers["attachments"] = attachments
                                        
                                        # Extract text from link or drive file attachments
                                        text_content = []
                                        drive_files_content = []
                                        
                                        for att in attachments:
                                            if att.get("link"):
                                                text_content.append(f"Link: {att['link'].get('url', '')}")
                                            elif att.get("driveFile"):
                                                drive_file = att.get("driveFile")
                                                file_title = drive_file.get("title", "untitled")
                                                text_content.append(f"Drive File: {file_title}")
                                                
                                                # Automatically download and extract Drive file content
                                                try:
                                                    file_content = await service.download_attachment(att)
                                                    # Try to extract text content
                                                    try:
                                                        extracted_text = file_content.decode('utf-8', errors='ignore')
                                                        if len(extracted_text.strip()) > 10 and '\x00' not in extracted_text[:100]:
                                                            drive_files_content.append(f"--- {file_title} ---\n{extracted_text}")
                                                            logger.info(f"Auto-extracted text from {file_title}: {len(extracted_text)} chars")
                                                    except Exception:
                                                        logger.info(f"Could not extract text from {file_title}, treating as binary")
                                                except Exception as e:
                                                    logger.warning(f"Could not download Drive file {file_title}: {e}")
                                        
                                        student_answers["text"] = "\n".join(text_content)
                                        
                                        # Add extracted Drive file content if available
                                        if drive_files_content:
                                            student_answers["extracted_text"] = "\n\n".join(drive_files_content)
                                    
                                    if student_answers:
                                        existing_submission.student_answers = student_answers
                                        logger.info(f"Updated student answers for submission {submission_id}")
                                        
                                except Exception as e:
                                    logger.error(f"Failed to fetch full submission details for {submission_id}: {e}")
                
                except Exception as e:
                    logger.warning(f"Failed to sync submissions for assignment {assignment.title}: {e}")
                    
        except Exception as e:
            logger.warning(f"Failed to sync submissions: {e}")
        
        # Update classroom sync timestamp
        from datetime import datetime
        classroom.last_sync_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "message": f"Successfully synced classroom",
            "assignments_synced": assignments_synced,
            "students_synced": students_synced,
            "submissions_synced": submissions_synced
        }
        
    except Exception as e:
        logger.error(f"Individual classroom sync failed: {e}")
        
        # Check if it's a scope issue
        error_str = str(e)
        if "invalid_scope" in error_str or "insufficient permissions" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Please re-authenticate with Google Classroom to access Drive files. Visit /api/v1/auth/login/google/classroom to update your permissions."
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )


@router.get("/{classroom_id}/students")
async def get_classroom_students(
    classroom_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get all students enrolled in a classroom"""
    # Verify classroom belongs to teacher
    result = await db.execute(
        select(Classroom).where(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )
    
    # Get students through enrollments
    from app.db.models import Student, Enrollment
    query = select(Student).join(Enrollment).where(Enrollment.classroom_id == classroom_id)
    result = await db.execute(query)
    students = result.scalars().all()
    
    # Return student data
    student_list = []
    for student in students:
        student_list.append({
            "id": str(student.id),
            "name": student.name,
            "email": student.email,
            "google_id": student.google_id,
            "created_at": student.created_at.isoformat() if student.created_at else None
        })
    
    return student_list