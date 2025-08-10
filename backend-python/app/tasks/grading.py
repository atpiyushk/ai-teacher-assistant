from celery import shared_task
import httpx
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging
from uuid import UUID
import json
from datetime import datetime

from app.core.config import settings
from app.db.models import Submission, SubmissionFile, Assignment, Question

logger = logging.getLogger(__name__)

# Create sync database connection for Celery
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@shared_task(bind=True, max_retries=2)
def grade_submission(self, submission_id: str, model: str = "azure-gpt-4"):
    """Grade a submission using LLM through MCP server"""
    
    db = SessionLocal()
    try:
        # Get submission with assignment
        submission = db.query(Submission).filter(Submission.id == UUID(submission_id)).first()
        if not submission:
            logger.error(f"Submission {submission_id} not found")
            return
        
        assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
        if not assignment:
            logger.error(f"Assignment for submission {submission_id} not found")
            return
        
        # Get submission files with OCR results
        files = db.query(SubmissionFile).filter(SubmissionFile.submission_id == UUID(submission_id)).all()
        
        # Collect all OCR text
        submission_content = []
        for file in files:
            if file.ocr_result and file.ocr_result.get("text"):
                submission_content.append({
                    "filename": file.filename,
                    "text": file.ocr_result["text"]
                })
        
        if not submission_content:
            raise Exception("No OCR content available for grading")
        
        # Get assignment questions for context
        questions = db.query(Question).filter(Question.assignment_id == assignment.id).all()
        
        # Build grading prompt
        grading_prompt = build_grading_prompt(assignment, questions, submission_content)
        
        # Call MCP server for grading
        with httpx.Client(timeout=120.0) as client:
            mcp_request = {
                "model": model,
                "messages": [
                    {"role": "user", "content": grading_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 2000,
                "system_prompt": "You are an expert teacher grading student assignments. Provide detailed, constructive feedback with specific scores."
            }
            
            response = client.post(
                f"{settings.MCP_SERVER_URL}/generate",
                json=mcp_request,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                llm_response = response.json()
                
                # Parse grading response
                grading_result = parse_grading_response(llm_response["content"], assignment.max_points)
                
                # Update submission with grading results
                submission.total_score = grading_result["total_score"]
                submission.feedback = grading_result["feedback"]
                submission.ai_feedback = {
                    "model": model,
                    "detailed_scores": grading_result.get("detailed_scores", {}),
                    "strengths": grading_result.get("strengths", []),
                    "improvements": grading_result.get("improvements", []),
                    "tokens_used": llm_response.get("usage", {}).get("total_tokens", 0),
                    "graded_at": datetime.utcnow().isoformat()
                }
                submission.status = "graded"
                submission.graded_at = datetime.utcnow()
                
                db.commit()
                
                logger.info(f"Grading completed for submission {submission_id}")
                return {
                    "status": "completed",
                    "submission_id": submission_id,
                    "total_score": grading_result["total_score"],
                    "model": model
                }
            else:
                raise Exception(f"MCP server error: {response.status_code} - {response.text}")
                
    except Exception as e:
        logger.error(f"Grading failed for submission {submission_id}: {e}")
        
        # Update submission status to failed
        submission.status = "failed"
        submission.feedback = f"Grading failed: {str(e)}"
        db.commit()
        
        # Retry if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying grading for submission {submission_id} (attempt {self.request.retries + 1})")
            raise self.retry(countdown=30 * (2 ** self.request.retries))
        
        return {
            "status": "failed",
            "submission_id": submission_id,
            "error": str(e)
        }
    
    finally:
        db.close()


def build_grading_prompt(assignment, questions, submission_content):
    """Build a comprehensive grading prompt"""
    
    prompt = f"""Please grade this student submission for the assignment: "{assignment.title}"

ASSIGNMENT DETAILS:
- Title: {assignment.title}
- Description: {assignment.description or "No description provided"}
- Instructions: {assignment.instructions or "No specific instructions"}
- Maximum Points: {assignment.max_points}
- Assignment Type: {assignment.assignment_type or "General"}

"""
    
    if assignment.grading_criteria:
        prompt += f"GRADING CRITERIA:\n{json.dumps(assignment.grading_criteria, indent=2)}\n\n"
    
    if questions:
        prompt += "QUESTIONS/REQUIREMENTS:\n"
        for i, question in enumerate(questions, 1):
            prompt += f"{i}. {question.question_text} (Points: {question.points})\n"
            if question.grading_criteria:
                prompt += f"   Grading Criteria: {question.grading_criteria}\n"
        prompt += "\n"
    
    prompt += "STUDENT SUBMISSION:\n"
    for i, content in enumerate(submission_content, 1):
        prompt += f"File {i}: {content['filename']}\n"
        prompt += f"Content:\n{content['text']}\n\n"
    
    prompt += """Please provide your grading in the following JSON format:
{
    "total_score": <numeric score out of maximum points>,
    "feedback": "<overall feedback for the student>",
    "detailed_scores": {
        "question_1": <score>,
        "question_2": <score>,
        ...
    },
    "strengths": ["<strength 1>", "<strength 2>", ...],
    "improvements": ["<improvement 1>", "<improvement 2>", ...]
}

Be specific, constructive, and fair in your grading. Focus on both what the student did well and areas for improvement."""
    
    return prompt


def parse_grading_response(response_text: str, max_points: float):
    """Parse the LLM grading response"""
    
    try:
        # Try to extract JSON from the response
        start_idx = response_text.find("{")
        end_idx = response_text.rfind("}") + 1
        
        if start_idx != -1 and end_idx > start_idx:
            json_str = response_text[start_idx:end_idx]
            grading_data = json.loads(json_str)
            
            # Ensure total_score is within bounds
            total_score = min(float(grading_data.get("total_score", 0)), max_points)
            
            return {
                "total_score": total_score,
                "feedback": grading_data.get("feedback", "No feedback provided"),
                "detailed_scores": grading_data.get("detailed_scores", {}),
                "strengths": grading_data.get("strengths", []),
                "improvements": grading_data.get("improvements", [])
            }
        else:
            # Fallback: extract basic feedback
            return {
                "total_score": max_points * 0.7,  # Default to 70%
                "feedback": response_text,
                "detailed_scores": {},
                "strengths": [],
                "improvements": []
            }
            
    except Exception as e:
        logger.error(f"Failed to parse grading response: {e}")
        return {
            "total_score": max_points * 0.5,  # Default to 50%
            "feedback": f"Grading completed but response format was unclear: {response_text[:500]}",
            "detailed_scores": {},
            "strengths": [],
            "improvements": []
        }


@shared_task
def batch_grade_submissions(submission_ids: list, model: str = "azure-gpt-4"):
    """Grade multiple submissions in batch"""
    results = []
    
    for submission_id in submission_ids:
        try:
            result = grade_submission.delay(submission_id, model)
            results.append({"submission_id": submission_id, "task_id": result.id})
        except Exception as e:
            logger.error(f"Failed to queue grading for submission {submission_id}: {e}")
            results.append({"submission_id": submission_id, "error": str(e)})
    
    return results