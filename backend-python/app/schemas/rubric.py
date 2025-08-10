from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class RubricLevel(BaseModel):
    title: str = Field(..., description="Level title (e.g., 'Excellent', 'Good', 'Needs Improvement')")
    description: str = Field(..., description="Detailed description of this performance level")
    points: float = Field(..., ge=0, description="Points awarded for this level")


class RubricCriterion(BaseModel):
    id: Optional[str] = Field(None, description="Unique identifier for the criterion")
    description: str = Field(..., description="What is being assessed")
    points: float = Field(..., ge=0, description="Maximum points for this criterion")
    levels: List[RubricLevel] = Field(..., description="Performance levels for this criterion")


class RubricBase(BaseModel):
    title: str = Field(..., description="Rubric title")
    description: Optional[str] = Field(None, description="Rubric description")
    criteria: List[RubricCriterion] = Field(..., description="Assessment criteria")


class RubricCreate(RubricBase):
    assignment_id: UUID = Field(..., description="Assignment this rubric belongs to")


class RubricUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Rubric title")
    description: Optional[str] = Field(None, description="Rubric description")
    criteria: Optional[List[RubricCriterion]] = Field(None, description="Assessment criteria")


class RubricResponse(RubricBase):
    id: UUID
    assignment_id: UUID
    google_rubric_id: Optional[str] = None
    total_points: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class RubricWithAssignment(RubricResponse):
    assignment_title: str
    assignment_type: str
    assignment_max_points: float


class RubricTemplate(BaseModel):
    """Predefined rubric templates"""
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    subject: Optional[str] = Field(None, description="Subject area")
    criteria: List[RubricCriterion] = Field(..., description="Template criteria")
    
    class Config:
        schema_extra = {
            "example": {
                "name": "Essay Writing Rubric",
                "description": "Standard rubric for evaluating essay assignments",
                "subject": "English",
                "criteria": [
                    {
                        "description": "Organization and Structure",
                        "points": 25,
                        "levels": [
                            {
                                "title": "Excellent",
                                "description": "Clear introduction, body, and conclusion with logical flow",
                                "points": 25
                            },
                            {
                                "title": "Good",
                                "description": "Generally well-organized with minor issues",
                                "points": 20
                            },
                            {
                                "title": "Needs Improvement",
                                "description": "Some organizational issues that affect clarity",
                                "points": 15
                            },
                            {
                                "title": "Poor",
                                "description": "Lacks clear organization",
                                "points": 10
                            }
                        ]
                    }
                ]
            }
        }


# Predefined rubric templates
RUBRIC_TEMPLATES = [
    RubricTemplate(
        name="Essay Writing Rubric",
        description="Comprehensive rubric for evaluating written essays",
        subject="English",
        criteria=[
            RubricCriterion(
                description="Organization and Structure",
                points=25,
                levels=[
                    RubricLevel(title="Excellent", description="Clear introduction, body, and conclusion with logical flow", points=25),
                    RubricLevel(title="Good", description="Generally well-organized with minor issues", points=20),
                    RubricLevel(title="Satisfactory", description="Adequate organization with some confusion", points=15),
                    RubricLevel(title="Needs Improvement", description="Poor organization that affects understanding", points=10)
                ]
            ),
            RubricCriterion(
                description="Content and Ideas",
                points=25,
                levels=[
                    RubricLevel(title="Excellent", description="Original, insightful ideas with strong supporting evidence", points=25),
                    RubricLevel(title="Good", description="Clear ideas with adequate support", points=20),
                    RubricLevel(title="Satisfactory", description="Basic ideas with minimal support", points=15),
                    RubricLevel(title="Needs Improvement", description="Unclear or unsupported ideas", points=10)
                ]
            ),
            RubricCriterion(
                description="Grammar and Mechanics",
                points=25,
                levels=[
                    RubricLevel(title="Excellent", description="Virtually error-free with varied sentence structure", points=25),
                    RubricLevel(title="Good", description="Minor errors that don't interfere with meaning", points=20),
                    RubricLevel(title="Satisfactory", description="Some errors but generally readable", points=15),
                    RubricLevel(title="Needs Improvement", description="Frequent errors that interfere with comprehension", points=10)
                ]
            ),
            RubricCriterion(
                description="Voice and Style",
                points=25,
                levels=[
                    RubricLevel(title="Excellent", description="Engaging voice appropriate for audience and purpose", points=25),
                    RubricLevel(title="Good", description="Clear voice with some personality", points=20),
                    RubricLevel(title="Satisfactory", description="Adequate voice but may be inconsistent", points=15),
                    RubricLevel(title="Needs Improvement", description="Weak or inappropriate voice", points=10)
                ]
            )
        ]
    ),
    RubricTemplate(
        name="Math Problem Solving",
        description="Rubric for evaluating mathematical problem-solving skills",
        subject="Mathematics",
        criteria=[
            RubricCriterion(
                description="Problem Understanding",
                points=25,
                levels=[
                    RubricLevel(title="Complete", description="Demonstrates complete understanding of the problem", points=25),
                    RubricLevel(title="Substantial", description="Demonstrates substantial understanding", points=20),
                    RubricLevel(title="Partial", description="Demonstrates partial understanding", points=15),
                    RubricLevel(title="Little", description="Demonstrates little understanding", points=10)
                ]
            ),
            RubricCriterion(
                description="Mathematical Procedures",
                points=25,
                levels=[
                    RubricLevel(title="Complete", description="Uses efficient and effective procedures", points=25),
                    RubricLevel(title="Substantial", description="Uses mostly effective procedures with minor errors", points=20),
                    RubricLevel(title="Partial", description="Uses some effective procedures but with errors", points=15),
                    RubricLevel(title="Little", description="Uses ineffective or incorrect procedures", points=10)
                ]
            ),
            RubricCriterion(
                description="Mathematical Communication",
                points=25,
                levels=[
                    RubricLevel(title="Complete", description="Clear, precise mathematical language and notation", points=25),
                    RubricLevel(title="Substantial", description="Generally clear with minor communication issues", points=20),
                    RubricLevel(title="Partial", description="Some unclear or imprecise communication", points=15),
                    RubricLevel(title="Little", description="Unclear or incorrect mathematical communication", points=10)
                ]
            ),
            RubricCriterion(
                description="Accuracy of Solution",
                points=25,
                levels=[
                    RubricLevel(title="Complete", description="Correct answer with accurate calculations", points=25),
                    RubricLevel(title="Substantial", description="Mostly correct with minor calculation errors", points=20),
                    RubricLevel(title="Partial", description="Some correct elements but significant errors", points=15),
                    RubricLevel(title="Little", description="Incorrect answer with major errors", points=10)
                ]
            )
        ]
    ),
    RubricTemplate(
        name="Science Lab Report",
        description="Rubric for evaluating science laboratory reports",
        subject="Science",
        criteria=[
            RubricCriterion(
                description="Hypothesis and Predictions",
                points=20,
                levels=[
                    RubricLevel(title="Excellent", description="Clear, testable hypothesis with logical predictions", points=20),
                    RubricLevel(title="Good", description="Adequate hypothesis with reasonable predictions", points=15),
                    RubricLevel(title="Satisfactory", description="Basic hypothesis with unclear predictions", points=10),
                    RubricLevel(title="Needs Improvement", description="Unclear or missing hypothesis", points=5)
                ]
            ),
            RubricCriterion(
                description="Experimental Design",
                points=20,
                levels=[
                    RubricLevel(title="Excellent", description="Well-designed experiment with controlled variables", points=20),
                    RubricLevel(title="Good", description="Generally sound design with minor issues", points=15),
                    RubricLevel(title="Satisfactory", description="Basic design with some control issues", points=10),
                    RubricLevel(title="Needs Improvement", description="Poor design lacking proper controls", points=5)
                ]
            ),
            RubricCriterion(
                description="Data Collection and Analysis",
                points=30,
                levels=[
                    RubricLevel(title="Excellent", description="Accurate data with thorough analysis and graphs", points=30),
                    RubricLevel(title="Good", description="Mostly accurate data with good analysis", points=25),
                    RubricLevel(title="Satisfactory", description="Adequate data with basic analysis", points=20),
                    RubricLevel(title="Needs Improvement", description="Inaccurate or insufficient data", points=15)
                ]
            ),
            RubricCriterion(
                description="Conclusions",
                points=30,
                levels=[
                    RubricLevel(title="Excellent", description="Clear conclusions supported by data with error analysis", points=30),
                    RubricLevel(title="Good", description="Generally sound conclusions with data support", points=25),
                    RubricLevel(title="Satisfactory", description="Basic conclusions with minimal data support", points=20),
                    RubricLevel(title="Needs Improvement", description="Unclear or unsupported conclusions", points=15)
                ]
            )
        ]
    )
]