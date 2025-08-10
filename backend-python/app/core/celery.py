from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "aisensei",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.ocr", "app.tasks.grading", "app.tasks.sync"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_reject_on_worker_lost=True,
    worker_disable_rate_limits=True,
    task_routes={
        "app.tasks.ocr.*": {"queue": "ocr"},
        "app.tasks.grading.*": {"queue": "grading"},
        "app.tasks.sync.*": {"queue": "sync"},
    },
)