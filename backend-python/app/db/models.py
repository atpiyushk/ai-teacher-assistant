from sqlalchemy import Column, String, DateTime, Boolean, Text, JSON, ForeignKey, Float, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    google_id = Column(String(255), unique=True, index=True)
    name = Column(String(255))
    avatar_url = Column(String(500))
    refresh_token = Column(Text)  #Encrypted Google refresh token
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    classrooms = relationship("Classroom", back_populates="teacher", cascade="all, delete-orphan")
    grading_templates = relationship("GradingTemplate", back_populates="teacher")


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    google_id = Column(String(255), unique=True, index=True)
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    enrollments = relationship("Enrollment", back_populates="student")
    submissions = relationship("Submission", back_populates="student")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    google_classroom_id = Column(String(255), unique=True, index=True)
    name = Column(String(255), nullable=False)
    section = Column(String(100))
    subject = Column(String(100))
    room = Column(String(50))
    sync_enabled = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    teacher = relationship("Teacher", back_populates="classrooms")
    assignments = relationship("Assignment", back_populates="classroom", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="classroom", cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())

    #Relationships
    classroom = relationship("Classroom", back_populates="enrollments")
    student = relationship("Student", back_populates="enrollments")

    #Unique constraint
    __table_args__ = (
        Index("idx_classroom_student", "classroom_id", "student_id", unique=True),
    )


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"), nullable=False)
    google_assignment_id = Column(String(255), unique=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    instructions = Column(Text)
    due_date = Column(DateTime(timezone=True))
    max_points = Column(Float, default=100)
    assignment_type = Column(String(50))  #quiz, homework, exam, project
    grading_criteria = Column(JSON)  #Structured grading rubric
    auto_grade = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    classroom = relationship("Classroom", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="assignment", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50))  #multiple_choice, short_answer, essay, math
    points = Column(Float, default=1)
    correct_answer = Column(JSON)  #For auto-grading
    grading_criteria = Column(Text)  #For essay/open-ended
    order = Column(Integer, default=0)

    #Relationships
    assignment = relationship("Assignment", back_populates="questions")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    google_submission_id = Column(String(255), unique=True, index=True)
    status = Column(String(50), default="pending")  #pending, processing, graded, returned
    submitted_at = Column(DateTime(timezone=True))
    graded_at = Column(DateTime(timezone=True))
    total_score = Column(Float)
    feedback = Column(Text)
    ai_feedback = Column(JSON)  #Detailed AI-generated feedback
    student_answers = Column(JSON)  #Student's text answers from Google Classroom
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")
    files = relationship("SubmissionFile", back_populates="submission", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="submission", cascade="all, delete-orphan")


class SubmissionFile(Base):
    __tablename__ = "submission_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  #S3 or local path
    file_type = Column(String(50))  #pdf, image, document
    file_size = Column(Integer)  #bytes
    ocr_status = Column(String(50), default="pending")  #pending, processing, completed, failed
    ocr_result = Column(JSON)  #OCR extracted text and metadata
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    #Relationships
    submission = relationship("Submission", back_populates="files")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    answer_text = Column(Text)
    answer_data = Column(JSON)  #For complex answer types
    score = Column(Float)
    feedback = Column(Text)
    ai_evaluation = Column(JSON)  #Detailed AI grading info

    #Relationships
    submission = relationship("Submission", back_populates="answers")


class GradingTemplate(Base):
    __tablename__ = "grading_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    template_type = Column(String(50))  #rubric, checklist, criteria
    criteria = Column(JSON, nullable=False)  #Detailed grading criteria
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    teacher = relationship("Teacher", back_populates="grading_templates")


class Rubric(Base):
    __tablename__ = "rubrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    google_rubric_id = Column(String(255), unique=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    criteria = Column(JSON, nullable=False)  #Array of rubric criteria
    total_points = Column(Float, default=100)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #Relationships
    assignment = relationship("Assignment", back_populates="rubric")


#Update Assignment model to include rubric relationship
Assignment.rubric = relationship("Rubric", back_populates="assignment", uselist=False, cascade="all, delete-orphan")


class OCRJob(Base):
    __tablename__ = "ocr_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("submission_files.id"), nullable=False)
    status = Column(String(50), default="queued")  #queued, processing, completed, failed
    worker_id = Column(String(100))  #OCR worker instance
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LLMRequest(Base):
    __tablename__ = "llm_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id"))
    model = Column(String(100), nullable=False)  #gpt-4, claude-3, gemini-pro
    request_type = Column(String(50))  #grade, feedback, explain
    prompt = Column(Text, nullable=False)
    response = Column(JSON)
    tokens_used = Column(Integer)
    cost = Column(Float)
    latency_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())