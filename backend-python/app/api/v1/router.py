from fastapi import APIRouter

from app.api.v1.endpoints import auth, teachers, classrooms, assignments, submissions, students, ocr, grading, rubrics

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(classrooms.router, prefix="/classrooms", tags=["classrooms"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(rubrics.router, prefix="/rubrics", tags=["rubrics"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["ocr"])
api_router.include_router(grading.router, prefix="/grading", tags=["grading"])