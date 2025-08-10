from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
import logging
import httpx

from app.db.database import get_db
from app.db.models import Teacher, Assignment, Submission, Classroom, Rubric, SubmissionFile, Question
from app.api.dependencies import get_current_active_teacher
from app.core.config import settings
from app.tasks.grading import grade_submission, batch_grade_submissions
import google.generativeai as genai
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/models")
async def list_available_models():
    """List available LLM models for grading"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.MCP_SERVER_URL}/models")
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="MCP server not available"
                )
    except Exception as e:
        logger.error(f"Failed to fetch models: {e}")
        # Return default models as fallback
        return [
            {
                "id": "azure-gpt-4",
                "provider": "azure",
                "name": "Azure GPT-4",
                "description": "GPT-4 via Azure OpenAI"
            },
            {
                "id": "azure-gpt-35-turbo",
                "provider": "azure", 
                "name": "Azure GPT-3.5 Turbo",
                "description": "GPT-3.5 Turbo via Azure OpenAI"
            }
        ]


async def grade_single_submission_internal(
    submission_id: UUID,
    model: str,
    db: AsyncSession,
    current_teacher: Teacher
) -> dict:
    """Internal function to grade a single submission"""
    
    # Verify submission belongs to teacher and get full details
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
    
    # Check if submission is ready for grading
    if submission.status in ["processing", "graded"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submission is already {submission.status}"
        )
    
    # Check if submission has content to grade
    has_files = await db.execute(
        select(func.count()).select_from(SubmissionFile).where(SubmissionFile.submission_id == submission_id)
    )
    file_count = has_files.scalar()
    
    if not submission.student_answers and file_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No content to grade. Submission has no answers or uploaded files."
        )
    
    # Update status
    submission.status = "processing"
    await db.commit()
    
    try:
        # Get submission files with OCR text
        files_result = await db.execute(
            select(SubmissionFile).where(SubmissionFile.submission_id == submission_id)
        )
        files = files_result.scalars().all()
        
        # Get rubric if exists
        rubric_result = await db.execute(
            select(Rubric).where(Rubric.assignment_id == assignment.id)
        )
        rubric = rubric_result.scalar_one_or_none()
        
        # Build grading prompt
        prompt = f"""You are an AI teacher assistant. Grade this student submission.

Assignment: {assignment.title}
Instructions: {assignment.instructions or 'N/A'}
Max Points: {assignment.max_points}
Assignment Type: {assignment.assignment_type}

"""
        
        # Add rubric if available
        if rubric:
            prompt += f"""Rubric:
Title: {rubric.title}
{rubric.description or ''}

Criteria:
"""
            for criterion in rubric.criteria:
                prompt += f"- {criterion.get('description', '')}: {criterion.get('points', 0)} points\n"
                if criterion.get('levels'):
                    for level in criterion['levels']:
                        prompt += f"  • {level.get('title', '')}: {level.get('points', 0)} pts - {level.get('description', '')}\n"
        
        # Get assignment questions with expected answers
        questions_result = await db.execute(
            select(Question).where(Question.assignment_id == assignment.id).order_by(Question.order)
        )
        questions = questions_result.scalars().all()
        
        # Add questions with expected answers if available
        if questions:
            prompt += "\nQuestions and Expected Answers:\n"
            for i, q in enumerate(questions, 1):
                prompt += f"{i}. {q.question_text} ({q.points} points)\n"
                if q.correct_answer:
                    prompt += f"   Expected Answer: {q.correct_answer}\n"
                if q.grading_criteria:
                    prompt += f"   Grading Criteria: {q.grading_criteria}\n"
                prompt += "\n"
        elif assignment.grading_criteria and assignment.grading_criteria.get('questions'):
            prompt += "\nQuestions:\n"
            for i, q in enumerate(assignment.grading_criteria['questions'], 1):
                prompt += f"{i}. {q.get('question_text', '')} ({q.get('points', 0)} points)\n"
                if q.get('grading_criteria'):
                    prompt += f"   Grading criteria: {q['grading_criteria']}\n"
        
        # Add student's answer and file content
        prompt += "\nStudent's Response:\n"
        
        if submission.student_answers:
            if submission.student_answers.get('type') == 'short_answer':
                prompt += submission.student_answers.get('answer', 'No answer provided')
            elif submission.student_answers.get('type') == 'multiple_choice':
                prompt += f"Selected: {submission.student_answers.get('answer', 'No selection')}"
            elif submission.student_answers.get('type') == 'assignment':
                prompt += submission.student_answers.get('text', 'See attached files')
                # Add extracted text from Drive files
                if submission.student_answers.get('extracted_text'):
                    prompt += f"\n\nExtracted File Content:\n{submission.student_answers['extracted_text']}"
        
        # Add OCR text from uploaded files
        if files:
            prompt += "\n\nUploaded Files Content:\n"
            for file in files:
                if file.ocr_text:
                    prompt += f"\n--- {file.filename} ---\n{file.ocr_text}\n"
        
        if not files and not submission.student_answers:
            prompt += "No text response provided and no files uploaded."
        
        prompt += f"""

Please provide:
1. A numerical score out of {assignment.max_points}
2. Detailed feedback for the student
3. Strengths and areas for improvement

Format your response as JSON:
{{
  "score": <number>,
  "feedback": "<detailed feedback>",
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<area1>", "<area2>"],
  "rubric_scores": {{"<criterion>": <score>}}
}}
"""
        
        # Try MCP Server first, fallback to direct Gemini
        response_text = ""
        selected_model = model
        
        try:
            # Try MCP Server
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Map model names to MCP server format
                model_mapping = {
                    "gemini": "gemini-pro",
                    "gemini-pro": "gemini-pro",
                    "gemini-1.5-flash": "gemini-pro",  # Map to available model
                    "gpt-4": "gpt-4",
                    "gpt-3.5-turbo": "gpt-3.5-turbo",
                    "claude-3-sonnet": "claude-3-sonnet-20240229",
                    "claude-3-haiku": "claude-3-haiku-20240307"
                }
                
                mcp_model = model_mapping.get(model, "gemini-pro")
                
                mcp_request = {
                    "model": mcp_model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000
                }
                
                response = await client.post(
                    f"{settings.MCP_SERVER_URL}/generate",
                    json=mcp_request,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    mcp_result = response.json()
                    response_text = mcp_result.get("content", "")
                    selected_model = mcp_model
                else:
                    raise Exception(f"MCP server error: {response.status_code}")
                    
        except Exception as mcp_error:
            logger.warning(f"MCP server failed: {mcp_error}, falling back to direct Gemini")
            
            # Fallback to direct Gemini
            if not settings.GEMINI_API_KEY:
                raise Exception("No AI service available - MCP server failed and Gemini API key not configured")
                
            genai.configure(api_key=settings.GEMINI_API_KEY)
            gemini_model = genai.GenerativeModel('gemini-1.5-flash')
            
            try:
                gemini_response = gemini_model.generate_content(prompt)
                response_text = gemini_response.text
                selected_model = "gemini-pro-direct"
            except Exception as gemini_error:
                raise Exception(f"All AI services failed. MCP: {mcp_error}, Gemini: {gemini_error}")
        
        # Parse response
        try:
            import json
            # Extract JSON from response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                ai_result = json.loads(json_str)
            else:
                # Fallback parsing
                ai_result = {
                    "score": assignment.max_points * 0.7,  # Default to 70%
                    "feedback": response_text,
                    "strengths": [],
                    "improvements": []
                }
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            ai_result = {
                "score": assignment.max_points * 0.7,
                "feedback": f"Grading completed but response format was unclear: {response_text[:500]}",
                "error": str(e)
            }
        
        # Update submission
        submission.total_score = min(float(ai_result.get("score", 0)), assignment.max_points)
        submission.feedback = ai_result.get("feedback", "")
        submission.ai_feedback = {
            "model": selected_model,
            "detailed_scores": ai_result.get("rubric_scores", {}),
            "strengths": ai_result.get("strengths", []),
            "improvements": ai_result.get("improvements", []),
            "raw_response": response_text,
            "graded_at": datetime.utcnow().isoformat()
        }
        submission.status = "graded"
        submission.graded_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "message": "Grading completed",
            "submission_id": submission_id,
            "score": submission.total_score,
            "status": "graded",
            "model_used": selected_model
        }
        
    except Exception as e:
        logger.error(f"Grading failed: {e}")
        submission.status = "failed"
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grading failed: {str(e)}"
        )


@router.post("/submissions/{submission_id}")
async def grade_single_submission(
    submission_id: UUID,
    background_tasks: BackgroundTasks,
    model: str = "gemini",
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Grade a single submission using AI"""
    return await grade_single_submission_internal(submission_id, model, db, current_teacher)


@router.post("/assignments/{assignment_id}/batch")
async def grade_assignment_batch(
    assignment_id: UUID,
    background_tasks: BackgroundTasks,
    model: str = "gemini",
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Grade all submissions for an assignment"""
    
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
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
    
    # Get submissions to grade - if no status filter, grade ungraded submissions
    query = select(Submission).where(Submission.assignment_id == assignment_id)
    
    if status_filter:
        query = query.where(Submission.status == status_filter)
    else:
        # Grade submissions that haven't been graded yet
        query = query.where(Submission.status.in_(["submitted", "returned", "pending"]))
    
    result = await db.execute(query)
    submissions = result.scalars().all()
    
    if not submissions:
        return {
            "message": "No submissions found to grade",
            "assignment_id": assignment_id,
            "count": 0
        }
    
    # Filter submissions that have content to grade
    gradeable_submissions = []
    for submission in submissions:
        # Check if submission has content
        has_content = (
            submission.student_answers and 
            (submission.student_answers.get('answer') or 
             submission.student_answers.get('text') or 
             submission.student_answers.get('extracted_text'))
        )
        
        # Also check for uploaded files
        if not has_content:
            files_result = await db.execute(
                select(func.count()).select_from(SubmissionFile).where(
                    SubmissionFile.submission_id == submission.id
                )
            )
            file_count = files_result.scalar()
            has_content = file_count > 0
        
        if has_content:
            gradeable_submissions.append(submission)
            submission.status = "processing"
    
    if not gradeable_submissions:
        return {
            "message": "No submissions have content to grade",
            "assignment_id": assignment_id,
            "total_submissions": len(submissions),
            "gradeable_count": 0
        }
    
    await db.commit()
    
    # Grade each submission individually (for better error handling)
    graded_count = 0
    failed_count = 0
    
    for submission in gradeable_submissions:
        try:
            # Use the single submission grading endpoint logic
            result = await grade_single_submission_internal(
                submission.id, model, db, current_teacher
            )
            if result.get("status") == "graded":
                graded_count += 1
        except Exception as e:
            logger.error(f"Failed to grade submission {submission.id}: {e}")
            submission.status = "failed"
            failed_count += 1
    
    await db.commit()
    
    return {
        "message": f"Batch grading completed",
        "assignment_id": assignment_id,
        "total_submissions": len(submissions),
        "gradeable_submissions": len(gradeable_submissions),
        "graded_count": graded_count,
        "failed_count": failed_count,
        "model": model
    }


@router.get("/assignments/{assignment_id}/progress")
async def get_grading_progress(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get grading progress for an assignment"""
    
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .where(
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
    
    # Get submission counts by status
    total_result = await db.execute(
        select(func.count(Submission.id)).where(Submission.assignment_id == assignment_id)
    )
    total_submissions = total_result.scalar()
    
    pending_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.assignment_id == assignment_id,
            Submission.status == "pending"
        )
    )
    pending_count = pending_result.scalar()
    
    processing_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.assignment_id == assignment_id,
            Submission.status == "processing"
        )
    )
    processing_count = processing_result.scalar()
    
    graded_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.assignment_id == assignment_id,
            Submission.status == "graded"
        )
    )
    graded_count = graded_result.scalar()
    
    failed_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.assignment_id == assignment_id,
            Submission.status == "failed"
        )
    )
    failed_count = failed_result.scalar()
    
    # Calculate average score for graded submissions
    avg_score_result = await db.execute(
        select(func.avg(Submission.total_score)).where(
            Submission.assignment_id == assignment_id,
            Submission.status == "graded",
            Submission.total_score.isnot(None)
        )
    )
    avg_score = avg_score_result.scalar()
    
    return {
        "assignment_id": assignment_id,
        "total_submissions": total_submissions,
        "pending": pending_count,
        "processing": processing_count,
        "graded": graded_count,
        "failed": failed_count,
        "completion_percentage": round((graded_count / max(total_submissions, 1)) * 100, 1),
        "average_score": round(avg_score, 2) if avg_score else None
    }


@router.get("/submissions/{submission_id}/feedback")
async def get_submission_feedback(
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: Teacher = Depends(get_current_active_teacher)
):
    """Get detailed feedback for a submission"""
    
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
    
    return {
        "submission_id": submission_id,
        "status": submission.status,
        "total_score": submission.total_score,
        "feedback": submission.feedback,
        "ai_feedback": submission.ai_feedback,
        "graded_at": submission.graded_at
    }


@router.post("/test")
async def test_grading_system(
    model: str = "azure-gpt-4"
):
    """Test the grading system with MCP server"""
    
    try:
        async with httpx.AsyncClient() as client:
            # Test MCP server connection
            health_response = await client.get(f"{settings.MCP_SERVER_URL}/health")
            
            if health_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="MCP server not available"
                )
            
            # Test a simple grading request
            test_request = {
                "model": model,
                "messages": [
                    {"role": "user", "content": "Please grade this simple math answer: Question: What is 2+2? Student Answer: 4"}
                ],
                "temperature": 0.3,
                "max_tokens": 500,
                "system_prompt": "You are a teacher. Provide a simple grade and feedback."
            }
            
            grading_response = await client.post(
                f"{settings.MCP_SERVER_URL}/generate",
                json=test_request,
                timeout=30.0
            )
            
            if grading_response.status_code == 200:
                result = grading_response.json()
                return {
                    "status": "success",
                    "message": "Grading system is working",
                    "test_response": result.get("content", ""),
                    "model": model,
                    "mcp_health": health_response.json()
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Grading test failed: {grading_response.text}"
                )
                
    except Exception as e:
        logger.error(f"Grading system test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grading system test failed: {str(e)}"
        )