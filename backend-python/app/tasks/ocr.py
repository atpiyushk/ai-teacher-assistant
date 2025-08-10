from celery import shared_task
import httpx
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging
from uuid import UUID
import json

from app.core.config import settings
from app.db.models import SubmissionFile
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

# Create sync database connection for Celery
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@shared_task(bind=True, max_retries=3)
def process_file_ocr(self, file_id: str):
    """Process a file with OCR using Surya OCR service"""
    
    db = SessionLocal()
    try:
        # Get submission file
        submission_file = db.query(SubmissionFile).filter(SubmissionFile.id == UUID(file_id)).first()
        if not submission_file:
            logger.error(f"SubmissionFile {file_id} not found")
            return
        
        # Update status to processing
        submission_file.ocr_status = "processing"
        db.commit()
        
        # Get file content
        file_content = asyncio.run(storage_service.get_file(submission_file.file_path))
        
        # Send to OCR service
        with httpx.Client(timeout=300.0) as client:
            files = {"file": (submission_file.filename, file_content, "application/octet-stream")}
            response = client.post(
                f"{settings.SURYA_OCR_URL}/ocr/process",
                files=files,
                data={"languages": json.dumps(["en"])}
            )
            
            if response.status_code == 200:
                ocr_result = response.json()
                
                # Update submission file with OCR result
                submission_file.ocr_result = ocr_result
                submission_file.ocr_status = "completed"
                db.commit()
                
                logger.info(f"OCR completed for file {file_id}")
                return {
                    "status": "completed",
                    "file_id": file_id,
                    "text_length": len(ocr_result.get("text", ""))
                }
            else:
                raise Exception(f"OCR service error: {response.status_code} - {response.text}")
                
    except Exception as e:
        logger.error(f"OCR processing failed for file {file_id}: {e}")
        
        # Update status to failed
        submission_file.ocr_status = "failed"
        db.commit()
        
        # Retry if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying OCR for file {file_id} (attempt {self.request.retries + 1})")
            raise self.retry(countdown=60 * (2 ** self.request.retries))
        
        return {
            "status": "failed",
            "file_id": file_id,
            "error": str(e)
        }
    
    finally:
        db.close()


@shared_task
def cleanup_temp_files():
    """Clean up temporary files older than 24 hours"""
    # TODO: Implement cleanup logic
    pass