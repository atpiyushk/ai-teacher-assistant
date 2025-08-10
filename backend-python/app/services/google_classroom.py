import httpx
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings

logger = logging.getLogger(__name__)


class GoogleClassroomService:
    """Service for interacting with Google Classroom API"""
    
    def __init__(self, refresh_token: str):
        self.refresh_token = refresh_token
        self.service = None
        self._initialize_service()
    
    def _initialize_service(self):
        """Initialize Google Classroom service with credentials"""
        try:
            # Create credentials from refresh token
            creds = Credentials(
                token=None,
                refresh_token=self.refresh_token,
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                token_uri="https://oauth2.googleapis.com/token",
                scopes=settings.GOOGLE_CLASSROOM_SCOPES
            )
            
            # Refresh the token
            creds.refresh(Request())
            
            # Build the service
            self.service = build('classroom', 'v1', credentials=creds)
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Classroom service: {e}")
            raise
    
    async def list_courses(self, course_states: List[str] = None) -> List[Dict[str, Any]]:
        """List all courses (classrooms) for the authenticated teacher"""
        if not course_states:
            course_states = ['ACTIVE']
        
        try:
            courses = []
            page_token = None
            
            while True:
                request = self.service.courses().list(
                    courseStates=course_states,
                    pageSize=100,
                    pageToken=page_token
                )
                
                response = request.execute()
                courses.extend(response.get('courses', []))
                
                page_token = response.get('nextPageToken')
                if not page_token:
                    break
            
            return courses
            
        except HttpError as e:
            logger.error(f"Failed to list courses: {e}")
            raise Exception(f"Google Classroom API error: {e}")
    
    async def get_course(self, course_id: str) -> Dict[str, Any]:
        """Get a specific course"""
        try:
            course = self.service.courses().get(id=course_id).execute()
            return course
        except HttpError as e:
            logger.error(f"Failed to get course {course_id}: {e}")
            raise Exception(f"Course not found: {e}")
    
    async def list_course_work(self, course_id: str) -> List[Dict[str, Any]]:
        """List all assignments (coursework) for a course"""
        try:
            coursework = []
            page_token = None
            
            while True:
                request = self.service.courses().courseWork().list(
                    courseId=course_id,
                    pageSize=100,
                    pageToken=page_token
                )
                
                response = request.execute()
                coursework.extend(response.get('courseWork', []))
                
                page_token = response.get('nextPageToken')
                if not page_token:
                    break
            
            return coursework
            
        except HttpError as e:
            logger.error(f"Failed to list coursework for {course_id}: {e}")
            raise Exception(f"Failed to get assignments: {e}")
    
    async def get_course_work(self, course_id: str, coursework_id: str) -> Dict[str, Any]:
        """Get a specific assignment"""
        try:
            coursework = self.service.courses().courseWork().get(
                courseId=course_id,
                id=coursework_id
            ).execute()
            return coursework
        except HttpError as e:
            logger.error(f"Failed to get coursework {coursework_id}: {e}")
            raise Exception(f"Assignment not found: {e}")
    
    async def create_course_work(
        self, 
        course_id: str,
        title: str,
        description: str = "",
        instructions: str = "",
        due_date: Optional[datetime] = None,
        max_points: float = 100,
        work_type: str = "ASSIGNMENT"
    ) -> Dict[str, Any]:
        """Create a new assignment in Google Classroom"""
        try:
            # Map our work types to Google Classroom work types
            valid_work_types = {
                "assignment": "ASSIGNMENT",
                "quiz": "SHORT_ANSWER_QUESTION",  # Map quiz to short answer
                "homework": "ASSIGNMENT",
                "exam": "ASSIGNMENT", 
                "project": "ASSIGNMENT"
            }
            
            # Normalize and map work type
            normalized_type = work_type.lower() if work_type else "assignment"
            google_work_type = valid_work_types.get(normalized_type, "ASSIGNMENT")
            
            # Prepare the coursework body
            coursework_body = {
                "title": title,
                "description": description or instructions,
                "workType": google_work_type,
                "state": "PUBLISHED",
                "maxPoints": max_points
            }
            
            # Add due date if provided
            if due_date:
                coursework_body["dueDate"] = {
                    "year": due_date.year,
                    "month": due_date.month,
                    "day": due_date.day
                }
                coursework_body["dueTime"] = {
                    "hours": due_date.hour,
                    "minutes": due_date.minute
                }
            
            # Create the assignment
            coursework = self.service.courses().courseWork().create(
                courseId=course_id,
                body=coursework_body
            ).execute()
            
            return coursework
            
        except HttpError as e:
            logger.error(f"Failed to create coursework in {course_id}: {e}")
            raise Exception(f"Failed to create assignment: {e}")
    
    async def update_course_work(
        self,
        course_id: str,
        coursework_id: str,
        title: str = None,
        description: str = None,
        due_date: Optional[datetime] = None,
        max_points: float = None
    ) -> Dict[str, Any]:
        """Update an existing assignment in Google Classroom"""
        try:
            # Get current coursework
            current = self.service.courses().courseWork().get(
                courseId=course_id,
                id=coursework_id
            ).execute()
            
            # Prepare update body
            update_body = current.copy()
            update_mask = []
            
            if title is not None:
                update_body["title"] = title
                update_mask.append("title")
            
            if description is not None:
                update_body["description"] = description
                update_mask.append("description")
            
            if max_points is not None:
                update_body["maxPoints"] = max_points
                update_mask.append("maxPoints")
            
            if due_date is not None:
                update_body["dueDate"] = {
                    "year": due_date.year,
                    "month": due_date.month,
                    "day": due_date.day
                }
                update_body["dueTime"] = {
                    "hours": due_date.hour,
                    "minutes": due_date.minute
                }
                update_mask.extend(["dueDate", "dueTime"])
            
            if not update_mask:
                return current  # Nothing to update
            
            # Update the assignment
            coursework = self.service.courses().courseWork().patch(
                courseId=course_id,
                id=coursework_id,
                updateMask=",".join(update_mask),
                body=update_body
            ).execute()
            
            return coursework
            
        except HttpError as e:
            logger.error(f"Failed to update coursework {coursework_id}: {e}")
            raise Exception(f"Failed to update assignment: {e}")
    
    async def list_student_submissions(
        self, 
        course_id: str, 
        coursework_id: str,
        states: List[str] = None
    ) -> List[Dict[str, Any]]:
        """List all student submissions for an assignment"""
        if not states:
            states = ['TURNED_IN', 'RETURNED']
        
        try:
            submissions = []
            page_token = None
            
            while True:
                request = self.service.courses().courseWork().studentSubmissions().list(
                    courseId=course_id,
                    courseWorkId=coursework_id,
                    states=states,
                    pageSize=100,
                    pageToken=page_token
                )
                
                response = request.execute()
                submissions.extend(response.get('studentSubmissions', []))
                
                page_token = response.get('nextPageToken')
                if not page_token:
                    break
            
            return submissions
            
        except HttpError as e:
            logger.error(f"Failed to list submissions: {e}")
            raise Exception(f"Failed to get submissions: {e}")
    
    async def get_student_submission(
        self, 
        course_id: str, 
        coursework_id: str, 
        submission_id: str
    ) -> Dict[str, Any]:
        """Get a specific student submission"""
        try:
            submission = self.service.courses().courseWork().studentSubmissions().get(
                courseId=course_id,
                courseWorkId=coursework_id,
                id=submission_id
            ).execute()
            return submission
        except HttpError as e:
            logger.error(f"Failed to get submission {submission_id}: {e}")
            raise Exception(f"Submission not found: {e}")
    
    async def return_student_submission(
        self, 
        course_id: str, 
        coursework_id: str, 
        submission_id: str,
        assigned_grade: Optional[float] = None,
        draft_grade: Optional[float] = None
    ) -> Dict[str, Any]:
        """Return a graded submission to student"""
        try:
            body = {}
            
            if assigned_grade is not None:
                body['assignedGrade'] = assigned_grade
            if draft_grade is not None:
                body['draftGrade'] = draft_grade
            
            # First, patch the submission with grades
            if body:
                self.service.courses().courseWork().studentSubmissions().patch(
                    courseId=course_id,
                    courseWorkId=coursework_id,
                    id=submission_id,
                    updateMask=','.join(body.keys()),
                    body=body
                ).execute()
            
            # Then return the submission
            result = self.service.courses().courseWork().studentSubmissions().return_(
                courseId=course_id,
                courseWorkId=coursework_id,
                id=submission_id
            ).execute()
            
            return result
            
        except HttpError as e:
            logger.error(f"Failed to return submission {submission_id}: {e}")
            raise Exception(f"Failed to return submission: {e}")
    
    async def list_students(self, course_id: str) -> List[Dict[str, Any]]:
        """List all students enrolled in a course"""
        try:
            students = []
            page_token = None
            
            while True:
                request = self.service.courses().students().list(
                    courseId=course_id,
                    pageSize=100,
                    pageToken=page_token
                )
                
                response = request.execute()
                students.extend(response.get('students', []))
                
                page_token = response.get('nextPageToken')
                if not page_token:
                    break
            
            return students
            
        except HttpError as e:
            logger.error(f"Failed to list students for course {course_id}: {e}")
            raise Exception(f"Failed to get students: {e}")
    
    async def download_attachment(self, attachment: Dict[str, Any]) -> bytes:
        """Download an attachment from Google Drive"""
        try:
            # Get the Drive file ID from the attachment
            drive_file = attachment.get('driveFile')
            if not drive_file:
                raise Exception("No Drive file in attachment")
            
            file_id = drive_file.get('id')
            file_title = drive_file.get('title', 'unknown')
            if not file_id:
                raise Exception("No file ID in Drive attachment")
            
            logger.info(f"Downloading Drive file: {file_title} (ID: {file_id})")
            
            # Use the Drive API to download the file
            # Note: This requires the Drive API to be enabled and proper scopes
            drive_service = build('drive', 'v3', credentials=self.service._http.credentials)
            
            # Get file metadata first
            try:
                file_metadata = drive_service.files().get(fileId=file_id).execute()
                logger.info(f"File metadata: {file_metadata.get('mimeType', 'unknown')} - {file_metadata.get('name', file_title)}")
            except HttpError as e:
                if e.resp.status == 403:
                    raise Exception(f"Access denied to Drive file '{file_title}'. Make sure the teacher has access to the file and Google Drive scope is granted.")
                elif e.resp.status == 404:
                    raise Exception(f"Drive file '{file_title}' not found. The file may have been deleted or moved.")
                else:
                    raise Exception(f"Failed to get file metadata for '{file_title}': {e}")
            
            # Download the file
            try:
                if file_metadata.get('mimeType') == 'application/vnd.google-apps.document':
                    # Google Docs - export as plain text for immediate reading
                    file_content = drive_service.files().export(
                        fileId=file_id,
                        mimeType='text/plain'
                    ).execute()
                    logger.info(f"Exported Google Doc as text: {len(file_content)} bytes")
                elif file_metadata.get('mimeType') == 'application/vnd.google-apps.spreadsheet':
                    # Google Sheets - export as CSV
                    file_content = drive_service.files().export(
                        fileId=file_id,
                        mimeType='text/csv'
                    ).execute()
                    logger.info(f"Exported Google Sheet as CSV: {len(file_content)} bytes")
                elif file_metadata.get('mimeType') == 'application/vnd.google-apps.presentation':
                    # Google Slides - export as plain text
                    file_content = drive_service.files().export(
                        fileId=file_id,
                        mimeType='text/plain'
                    ).execute()
                    logger.info(f"Exported Google Slides as text: {len(file_content)} bytes")
                else:
                    # Regular file
                    file_content = drive_service.files().get_media(fileId=file_id).execute()
                    logger.info(f"Downloaded regular file: {len(file_content)} bytes")
                
                return file_content
                
            except HttpError as e:
                if e.resp.status == 403:
                    raise Exception(f"Access denied when downloading '{file_title}'. Check file permissions and Drive API access.")
                else:
                    raise Exception(f"Failed to download '{file_title}': {e}")
            
        except HttpError as e:
            logger.error(f"Drive API error: {e}")
            raise Exception(f"Drive API error: {e}")
        except Exception as e:
            logger.error(f"Failed to download attachment: {e}")
            raise
    
    def parse_due_date(self, due_date_dict: Dict[str, Any]) -> Optional[datetime]:
        """Parse Google Classroom due date format to datetime"""
        if not due_date_dict:
            return None
        
        try:
            date_part = due_date_dict.get('date', {})
            time_part = due_date_dict.get('timeOfDay', {})
            
            year = date_part.get('year')
            month = date_part.get('month')
            day = date_part.get('day')
            
            if not all([year, month, day]):
                return None
            
            hour = time_part.get('hours', 23)
            minute = time_part.get('minutes', 59)
            
            return datetime(year, month, day, hour, minute)
            
        except Exception as e:
            logger.error(f"Failed to parse due date: {e}")
            return None
    
    async def create_rubric(
        self,
        course_id: str,
        coursework_id: str,
        title: str,
        criteria: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Create a rubric for an assignment in Google Classroom"""
        try:
            # Google Classroom rubric structure
            rubric_body = {
                "criteria": []
            }
            
            for criterion in criteria:
                rubric_criterion = {
                    "id": criterion.get("id", ""),
                    "description": criterion.get("description", ""),
                    "points": float(criterion.get("points", 10)),
                    "levels": []
                }
                
                # Add performance levels for this criterion
                levels = criterion.get("levels", [])
                for level in levels:
                    rubric_level = {
                        "title": level.get("title", ""),
                        "description": level.get("description", ""),
                        "points": float(level.get("points", 0))
                    }
                    rubric_criterion["levels"].append(rubric_level)
                
                rubric_body["criteria"].append(rubric_criterion)
            
            # Create rubric
            rubric = self.service.courses().courseWork().rubric().create(
                courseId=course_id,
                courseWorkId=coursework_id,
                body=rubric_body
            ).execute()
            
            return rubric
            
        except HttpError as e:
            logger.error(f"Failed to create rubric: {e}")
            raise Exception(f"Failed to create rubric: {e}")
    
    async def get_rubric(self, course_id: str, coursework_id: str) -> Dict[str, Any]:
        """Get rubric for an assignment"""
        try:
            rubric = self.service.courses().courseWork().rubric().get(
                courseId=course_id,
                courseWorkId=coursework_id
            ).execute()
            return rubric
        except HttpError as e:
            if e.resp.status == 404:
                return None  # No rubric exists
            logger.error(f"Failed to get rubric: {e}")
            raise Exception(f"Failed to get rubric: {e}")
    
    async def update_rubric(
        self,
        course_id: str,
        coursework_id: str,
        criteria: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Update an existing rubric"""
        try:
            # Get existing rubric first
            existing_rubric = await self.get_rubric(course_id, coursework_id)
            if not existing_rubric:
                raise Exception("No existing rubric to update")
            
            # Update rubric structure
            rubric_body = {
                "criteria": []
            }
            
            for criterion in criteria:
                rubric_criterion = {
                    "id": criterion.get("id", ""),
                    "description": criterion.get("description", ""),
                    "points": float(criterion.get("points", 10)),
                    "levels": []
                }
                
                # Add performance levels
                levels = criterion.get("levels", [])
                for level in levels:
                    rubric_level = {
                        "title": level.get("title", ""),
                        "description": level.get("description", ""),
                        "points": float(level.get("points", 0))
                    }
                    rubric_criterion["levels"].append(rubric_level)
                
                rubric_body["criteria"].append(rubric_criterion)
            
            # Update rubric
            rubric = self.service.courses().courseWork().rubric().patch(
                courseId=course_id,
                courseWorkId=coursework_id,
                body=rubric_body
            ).execute()
            
            return rubric
            
        except HttpError as e:
            logger.error(f"Failed to update rubric: {e}")
            raise Exception(f"Failed to update rubric: {e}")
    
    async def delete_rubric(self, course_id: str, coursework_id: str) -> bool:
        """Delete a rubric from an assignment"""
        try:
            self.service.courses().courseWork().rubric().delete(
                courseId=course_id,
                courseWorkId=coursework_id
            ).execute()
            return True
        except HttpError as e:
            logger.error(f"Failed to delete rubric: {e}")
            return False