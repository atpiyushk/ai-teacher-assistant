from celery import shared_task
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import UUID

from app.core.config import settings
from app.db.models import Teacher, Classroom
from app.services.google_classroom import GoogleClassroomService

logger = logging.getLogger(__name__)

# Create sync database connection for Celery
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@shared_task
def sync_google_classroom(teacher_id: str):
    """Sync Google Classroom data for a teacher"""
    
    db = SessionLocal()
    try:
        teacher = db.query(Teacher).filter(Teacher.id == UUID(teacher_id)).first()
        if not teacher or not teacher.refresh_token:
            logger.error(f"Teacher {teacher_id} not found or no refresh token")
            return
        
        # Initialize Google Classroom service
        gc_service = GoogleClassroomService(teacher.refresh_token)
        
        # Sync classrooms
        # This is a placeholder - actual implementation would be async
        logger.info(f"Syncing Google Classroom for teacher {teacher_id}")
        
        return {"status": "completed", "teacher_id": teacher_id}
        
    except Exception as e:
        logger.error(f"Google Classroom sync failed for teacher {teacher_id}: {e}")
        return {"status": "failed", "teacher_id": teacher_id, "error": str(e)}
    
    finally:
        db.close()


@shared_task
def sync_all_teachers():
    """Sync Google Classroom for all teachers with enabled sync"""
    
    db = SessionLocal()
    try:
        teachers = db.query(Teacher).filter(
            Teacher.refresh_token.isnot(None),
            Teacher.is_active == True
        ).all()
        
        results = []
        for teacher in teachers:
            result = sync_google_classroom.delay(str(teacher.id))
            results.append({"teacher_id": str(teacher.id), "task_id": result.id})
        
        return {"status": "completed", "synced_teachers": len(results), "results": results}
        
    except Exception as e:
        logger.error(f"Batch sync failed: {e}")
        return {"status": "failed", "error": str(e)}
    
    finally:
        db.close()