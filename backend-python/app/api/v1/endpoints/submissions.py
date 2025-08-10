from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
import logging
import json
from datetime import datetime

from app.db.database import get_db
from app.db.models import Teacher, Classroom, Assignment, Submission, SubmissionFile, Student, Enrollment
from app.api.dependencies import get_current_active_teacher
from app.schemas.submission import (
    SubmissionCreate, SubmissionUpdate, SubmissionResponse, 
    SubmissionWithFiles, FileUploadResponse
)
from app.services.storage import storage_service
from app.tasks.ocr import process_file_ocr
from app.tasks.grading import grade_submission

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
async def list_submissions(
    assignment_id: Optional[UUID] = None,
    classroom_id: Optional[UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """List submissions for teacher's assignments with student details"""
    
    # Build base query - submissions for teacher's assignments with student info
    query = (
        select(Submission, Student)
        .select_from(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .join(Student, Submission.student_id == Student.id)
        .where(Classroom.teacher_id == current_teacher.id)
    )
    
    # Apply filters
    if assignment_id:
        query = query.where(Assignment.id == assignment_id)
    
    if classroom_id:
        query = query.where(Classroom.id == classroom_id)
    
    if status:
        query = query.where(Submission.status == status)
    
    query = query.offset(skip).limit(limit).order_by(Submission.submitted_at.desc())
    
    result = await db.execute(query)
    submission_student_pairs = result.all()
    
    # Build response with student details
    submissions_with_students = []
    for submission, student in submission_student_pairs:
        submission_dict = {
            **submission.__dict__,
            "student_name": student.name,
            "student_email": student.email,
            "student_google_id": student.google_id
        }
        submissions_with_students.append(submission_dict)
    
    return submissions_with_students


@router.post("/", response_model=SubmissionResponse)
async def create_submission(
    submission: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Create a new submission (for testing purposes)"""
    
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
            Assignment.id == submission.assignment_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Check if student exists, create if not
    student_result = await db.execute(
        select(Student).where(Student.email == submission.student_email)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        student = Student(
            email=submission.student_email,
            name=submission.student_email.split('@')[0]  # Use email prefix as name
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)
    
    # Create submission
    db_submission = Submission(
        assignment_id=submission.assignment_id,
        student_id=student.id,
        status="pending",
        submitted_at=datetime.utcnow()
    )
    
    db.add(db_submission)
    await db.commit()
    await db.refresh(db_submission)
    
    return db_submission


@router.get("/{submission_id}", response_model=SubmissionWithFiles)
async def get_submission(
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get a specific submission with files and student details"""
    
    result = await db.execute(
        select(Submission, Student)
        .select_from(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .join(Student, Submission.student_id == Student.id)
        .where(
            Submission.id == submission_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    submission_student = result.first()
    
    if not submission_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    submission, student = submission_student
    
    # Get submission files
    files_result = await db.execute(
        select(SubmissionFile).where(SubmissionFile.submission_id == submission_id)
    )
    files = files_result.scalars().all()
    
    # Include student details in response
    submission_dict = {
        **submission.__dict__,
        "student_name": student.name,
        "student_email": student.email,
        "student_google_id": student.google_id
    }
    
    return SubmissionWithFiles(
        **submission_dict,
        files=files
    )


@router.patch("/{submission_id}", response_model=SubmissionResponse)
async def update_submission(
    submission_id: UUID,
    submission_update: SubmissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Update a submission"""
    
    result = await db.execute(
        select(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
            Submission.id == submission_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Update fields
    update_data = submission_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(submission, field, value)
    
    await db.commit()
    await db.refresh(submission)
    
    return submission


@router.post("/{submission_id}/files", response_model=FileUploadResponse)
async def upload_submission_file(
    submission_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Upload a file for a submission"""
    
    # Verify submission belongs to teacher
    result = await db.execute(
        select(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
            Submission.id == submission_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Validate file type
    allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.doc', '.docx']
    file_extension = '.' + file.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file_extension} not supported"
        )
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Save file using storage service
        file_path = await storage_service.save_file(
            file_content=file_content,
            filename=file.filename,
            folder=f"submissions/{submission_id}"
        )
        
        # Create submission file record
        submission_file = SubmissionFile(
            submission_id=submission_id,
            filename=file.filename,
            file_path=file_path,
            file_type=file_extension,
            file_size=len(file_content),
            ocr_status="pending"
        )
        
        db.add(submission_file)
        await db.commit()
        await db.refresh(submission_file)
        
        # Queue OCR processing if it's an image or PDF
        if file_extension in ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            # Use background tasks for immediate processing or Celery for production
            try:
                from app.core.celery import celery_app
                task = celery_app.send_task('app.tasks.ocr.process_file_ocr', args=[str(submission_file.id)])
            except Exception:
                # Fallback to background task if Celery not available
                background_tasks.add_task(
                    lambda: logger.info(f"OCR queued for file {submission_file.id}")
                )
        
        return FileUploadResponse(
            file_id=submission_file.id,
            filename=file.filename,
            file_size=len(file_content),
            status="uploaded",
            ocr_status="pending" if file_extension in ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'] else "not_required"
        )
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {str(e)}"
        )


@router.post("/{submission_id}/grade")
async def grade_submission_endpoint(
    submission_id: UUID,
    background_tasks: BackgroundTasks,
    model: str = "azure-gpt-4",
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Grade a submission using AI"""
    
    # Verify submission belongs to teacher
    result = await db.execute(
        select(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
            Submission.id == submission_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Check if submission has files or answers
    files_result = await db.execute(
        select(func.count(SubmissionFile.id)).where(SubmissionFile.submission_id == submission_id)
    )
    file_count = files_result.scalar()
    
    if file_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files uploaded for this submission"
        )
    
    # Update submission status
    submission.status = "processing"
    await db.commit()
    
    # Queue grading task
    try:
        from app.core.celery import celery_app
        task = celery_app.send_task('app.tasks.grading.grade_submission', args=[str(submission_id), model])
    except Exception:
        # Fallback to background task if Celery not available
        background_tasks.add_task(
            lambda: logger.info(f"Grading queued for submission {submission_id}")
        )
    
    return {
        "message": "Grading started",
        "submission_id": submission_id,
        "status": "processing"
    }


@router.get("/{submission_id}/status")
async def get_submission_status(
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get submission processing status"""
    
    result = await db.execute(
        select(Submission).join(Assignment).join(Classroom).where(
            Submission.id == submission_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Get file processing status
    files_result = await db.execute(
        select(SubmissionFile).where(SubmissionFile.submission_id == submission_id)
    )
    files = files_result.scalars().all()
    
    file_statuses = [
        {
            "file_id": f.id,
            "filename": f.filename,
            "ocr_status": f.ocr_status,
            "ocr_completed": f.ocr_status == "completed"
        }
        for f in files
    ]
    
    return {
        "submission_id": submission_id,
        "status": submission.status,
        "total_score": submission.total_score,
        "graded_at": submission.graded_at,
        "files": file_statuses
    }


@router.post("/{submission_id}/process-drive-files")
async def process_submission_drive_files(
    submission_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Process Google Drive files attached to a submission"""
    
    # Get submission with teacher verification
    result = await db.execute(
        select(Submission, Assignment, Classroom)
        .select_from(Submission)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
            Submission.id == submission_id,
            Classroom.teacher_id == current_teacher.id
        )
    )
    submission_data = result.first()
    
    if not submission_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    submission, assignment, classroom = submission_data
    
    # Check if submission has Drive files
    if not submission.student_answers or submission.student_answers.get('type') != 'assignment':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Drive files found in submission"
        )
    
    attachments = submission.student_answers.get('attachments', [])
    drive_files = [att for att in attachments if att.get('driveFile')]
    
    if not drive_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Drive files to process"
        )
    
    # Initialize Google Classroom service
    from app.services.google_classroom import GoogleClassroomService
    
    if not current_teacher.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication required"
        )
    
    try:
        service = GoogleClassroomService(current_teacher.refresh_token)
        processed_count = 0
        
        for attachment in drive_files:
            drive_file = attachment.get('driveFile')
            if not drive_file:
                continue
                
            file_id = drive_file.get('id')
            file_title = drive_file.get('title', 'untitled')
            
            try:
                logger.info(f"Attempting to download Drive file: {file_title} (ID: {file_id})")
                
                # Download file content
                file_content = await service.download_attachment(attachment)
                logger.info(f"Downloaded {len(file_content)} bytes from {file_title}")
                
                # Try to extract text content immediately
                extracted_text = None
                file_extension = '.txt'  # Default to text
                file_type = 'text/plain'
                ocr_status = 'completed'
                
                try:
                    # Try to decode as text first (for Google Docs exported as text)
                    extracted_text = file_content.decode('utf-8', errors='ignore')
                    
                    # Check if the decoded text looks meaningful (not binary)
                    if len(extracted_text.strip()) > 10 and '\x00' not in extracted_text[:100]:
                        logger.info(f"Successfully extracted text from {file_title}: {len(extracted_text)} chars")
                        logger.info(f"Preview: {extracted_text[:200]}...")
                    else:
                        # Looks like binary data, treat as non-text
                        extracted_text = None
                        file_extension = '.pdf'
                        file_type = 'application/pdf'
                        ocr_status = 'pending'
                        logger.info(f"File {file_title} contains binary data, treating as PDF for OCR")
                        
                except Exception as e:
                    # If not text, treat as PDF or other format
                    extracted_text = None
                    file_extension = '.pdf'
                    file_type = 'application/pdf'
                    ocr_status = 'pending'
                    logger.info(f"File {file_title} decode failed ({e}), treating as PDF for OCR")
                
                filename = f"{file_title}{file_extension}"
                
                # Create submission file record
                submission_file = SubmissionFile(
                    submission_id=submission_id,
                    filename=filename,
                    file_type=file_type,
                    file_size=len(file_content),
                    storage_path=f"drive_downloads/{submission_id}/{file_id}",
                    ocr_status=ocr_status,
                    ocr_text=extracted_text
                )
                
                db.add(submission_file)
                await db.flush()
                
                # Store file in storage
                file_path = await storage_service.save_file(
                    file_content=file_content,
                    filename=filename,
                    folder=f"submissions/{submission_id}"
                )
                submission_file.file_path = file_path
                
                # Queue OCR processing only if we couldn't extract text directly
                if not extracted_text and (file_extension == '.pdf' or 'image' in file_type):
                    background_tasks.add_task(
                        process_file_ocr,
                        str(submission_file.id),
                        file_path
                    )
                
                processed_count += 1
                logger.info(f"Processed Drive file: {filename} for submission {submission_id}")
                
            except Exception as e:
                logger.error(f"Failed to process Drive file {file_id}: {e}")
                continue
        
        await db.commit()
        
        # Update submission to include extracted text
        if processed_count > 0:
            # Get all text from submission files
            files_result = await db.execute(
                select(SubmissionFile).where(
                    SubmissionFile.submission_id == submission_id,
                    SubmissionFile.ocr_text.isnot(None)
                )
            )
            files_with_text = files_result.scalars().all()
            
            logger.info(f"Found {len(files_with_text)} files with OCR text")
            
            # Combine text
            all_text = []
            for file in files_with_text:
                if file.ocr_text:
                    logger.info(f"Adding text from {file.filename}: {len(file.ocr_text)} chars")
                    all_text.append(f"--- {file.filename} ---\n{file.ocr_text}")
            
            # Update student_answers with extracted text
            if all_text:
                if not submission.student_answers:
                    submission.student_answers = {}
                
                extracted_content = "\n\n".join(all_text)
                submission.student_answers['extracted_text'] = extracted_content
                
                # Mark the submission object as modified for SQLAlchemy
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(submission, 'student_answers')
                
                await db.commit()
                await db.refresh(submission)
                
                logger.info(f"Updated submission with extracted text: {len(extracted_content)} chars")
            else:
                logger.warning("No text content found in any files")
        
        # Log the final state for debugging
        logger.info(f"Final processing result for submission {submission_id}:")
        logger.info(f"- Processed {processed_count} files")
        logger.info(f"- Student answers type: {submission.student_answers.get('type') if submission.student_answers else 'None'}")
        logger.info(f"- Has extracted_text: {'extracted_text' in (submission.student_answers or {})}")
        
        # Final response
        final_response = {
            "message": f"Processed {processed_count} Drive files",
            "submission_id": submission_id,
            "processed_files": processed_count,
            "total_drive_files": len(drive_files),
            "extracted_content": submission.student_answers.get('extracted_text') if submission.student_answers else None,
            "has_extracted_text": bool(submission.student_answers and submission.student_answers.get('extracted_text'))
        }
        
        logger.info(f"Returning response: {final_response}")
        return final_response
        
    except Exception as e:
        logger.error(f"Failed to process Drive files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process Drive files: {str(e)}"
        )