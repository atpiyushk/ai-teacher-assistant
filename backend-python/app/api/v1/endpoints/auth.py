from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import httpx
from datetime import timedelta
import secrets
import json

from app.db.database import get_db
from app.db.models import Teacher, Student
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.schemas.auth import Token, TokenData, GoogleAuthCallback, RefreshTokenRequest, LoginRequest
from app.schemas.teacher import TeacherCreate, TeacherRegister, TeacherResponse
from app.api.dependencies import get_current_active_teacher
from google.auth.transport import requests
from google.oauth2 import id_token

router = APIRouter()

# Google OAuth2 URLs
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo"


@router.get("/login/google")
async def google_login(
    classroom_access: bool = False,
    force_consent: bool = False,
    db: AsyncSession = Depends(get_db)
):
    # """Initiate Google OAuth2 login flow"""
    # # Check if Google OAuth is properly configured
    # if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID == "your-google-client-id":
    #     # For hackathon demo - simulate Google OAuth flow
    #     # In production, this would redirect to Google's OAuth page
    #     demo_user = {
    #         "id": "demo_google_user_123", 
    #         "email": "hackathon@teacher.com",
    #         "name": "Hackathon Demo Teacher",
    #         "picture": "https://via.placeholder.com/96x96.png?text=HT"
    #     }
        
    #     # Simulate callback flow directly
    #     try:
    #         # Check if user exists
    #         result = await db.execute(
    #             select(Teacher).where(Teacher.google_id == demo_user["id"])
    #         )
    #         teacher = result.scalar_one_or_none()
            
    #         if not teacher:
    #             # Create new teacher
    #             teacher = Teacher(
    #                 email=demo_user["email"],
    #                 google_id=demo_user["id"],
    #                 name=demo_user.get("name"),
    #                 avatar_url=demo_user.get("picture"),
    #                 is_active=True
    #             )
    #             db.add(teacher)
    #             await db.commit()
    #             await db.refresh(teacher)
            
    #         # Create JWT tokens
    #         access_token = create_access_token(
    #             data={"sub": str(teacher.id), "email": teacher.email}
    #         )
    #         refresh_token = create_refresh_token(
    #             data={"sub": str(teacher.id)}
    #         )
            
    #         # Redirect to frontend with tokens
    #         frontend_url = "http://localhost:3000"
    #         redirect_url = f"{frontend_url}/auth/simple-callback?access_token={access_token}&refresh_token={refresh_token}"
            
    #         return RedirectResponse(url=redirect_url)
            
    #     except Exception as e:
    #         # Redirect to frontend with error
    #         frontend_url = "http://localhost:3000"
    #         error_url = f"{frontend_url}/login?error=oauth_failed"
    #         return RedirectResponse(url=error_url)
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(settings.GOOGLE_CLASSROOM_SCOPES if classroom_access else settings.GOOGLE_BASIC_SCOPES),
        "access_type": "offline",
        "prompt": "consent" if force_consent or classroom_access else "select_account",
        "state": secrets.token_urlsafe(32)
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?" + "&".join([f"{k}={v}" for k, v in params.items()])
    
    # For OAuth flow, we should redirect directly to Google
    return RedirectResponse(url=auth_url)


@router.get("/login/google/classroom")
async def google_classroom_login(db: AsyncSession = Depends(get_db)):
    """Initiate Google OAuth2 login flow with Classroom permissions"""
    return await google_login(classroom_access=True, db=db)


@router.get("/callback/google")
async def google_callback(
    code: str,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Handle Google OAuth2 callback for both teachers and students"""
    try:
        # Check if this is a student login based on state
        is_student_login = state and state.startswith("student_login_")
        
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange authorization code"
                )
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            
            # Get user info
            user_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user information"
                )
            
            user_info = user_response.json()
        
        if is_student_login:
            # Handle student login
            result = await db.execute(
                select(Student).where(Student.google_id == user_info["id"])
            )
            student = result.scalar_one_or_none()
            
            if not student:
                # Create new student
                student = Student(
                    email=user_info["email"],
                    google_id=user_info["id"],
                    name=user_info.get("name"),
                    avatar_url=user_info.get("picture"),
                    is_active=True
                )
                db.add(student)
                await db.commit()
                await db.refresh(student)
            
            # Create student-specific JWT tokens
            access_token = create_access_token(
                data={"sub": str(student.id), "email": student.email, "role": "student"}
            )
            refresh_token = create_refresh_token(
                data={"sub": str(student.id), "role": "student"}
            )
            
            # Redirect to student portal with tokens and student data
            frontend_url = "http://localhost:3000"
            student_data = json.dumps({
                "id": str(student.id),
                "email": student.email,
                "name": student.name,
                "avatar_url": student.avatar_url
            })
            redirect_url = f"{frontend_url}/student-portal?student_data={student_data}&token={access_token}"
            
            return RedirectResponse(url=redirect_url)
        
        else:
            # Handle teacher login (existing logic)
            result = await db.execute(
                select(Teacher).where(Teacher.google_id == user_info["id"])
            )
            teacher = result.scalar_one_or_none()
            
            if not teacher:
                # Create new teacher
                teacher = Teacher(
                    email=user_info["email"],
                    google_id=user_info["id"],
                    name=user_info.get("name"),
                    avatar_url=user_info.get("picture"),
                    refresh_token=refresh_token  # TODO: Encrypt this
                )
                db.add(teacher)
                await db.commit()
                await db.refresh(teacher)
            else:
                # Update refresh token if provided
                if refresh_token:
                    teacher.refresh_token = refresh_token  # TODO: Encrypt this
                    await db.commit()
            
            # Create JWT tokens
            access_token = create_access_token(
                data={"sub": str(teacher.id), "email": teacher.email}
            )
            refresh_token = create_refresh_token(
                data={"sub": str(teacher.id)}
            )
            
            # Redirect to frontend with tokens
            frontend_url = "http://localhost:3000"  # TODO: Make configurable
            redirect_url = f"{frontend_url}/auth/simple-callback?access_token={access_token}&refresh_token={refresh_token}"
            
            return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        # Redirect with error based on user type
        frontend_url = "http://localhost:3000"
        if is_student_login:
            error_url = f"{frontend_url}/student-login?error=oauth_failed&message={str(e)}"
        else:
            error_url = f"{frontend_url}/login?error=oauth_failed"
        return RedirectResponse(url=error_url)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    payload = verify_token(request.refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Get user
    user_id = payload.get("sub")
    result = await db.execute(
        select(Teacher).where(Teacher.id == user_id)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher or not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token = create_access_token(
        data={"sub": str(teacher.id), "email": teacher.email}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": request.refresh_token  # Return same refresh token
    }


@router.post("/logout")
async def logout(response: Response):
    """Logout user (client should discard tokens)"""
    # In a more sophisticated setup, you might want to:
    # - Invalidate the refresh token in the database
    # - Add the access token to a blacklist
    # - Clear any server-side sessions
    
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    
    return {"message": "Successfully logged out"}


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password"""
    # Find user by email
    result = await db.execute(
        select(Teacher).where(Teacher.email == login_data.email)
    )
    teacher = result.scalar_one_or_none()
    
    if not teacher or not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # TODO: In production, verify hashed password
    # For now, we're just checking if teacher exists
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(teacher.id), "email": teacher.email}, 
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"sub": str(teacher.id)}
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/register", response_model=Token)
async def register(
    user_data: TeacherRegister,
    db: AsyncSession = Depends(get_db)
):
    """Register a new teacher"""
    # Check if user already exists
    result = await db.execute(
        select(Teacher).where(Teacher.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new teacher
    teacher = Teacher(
        email=user_data.email,
        name=user_data.name,
        # Note: In production, you'd hash the password
        # For now, we'll store it directly (NOT RECOMMENDED)
        is_active=True
    )
    
    db.add(teacher)
    await db.commit()
    await db.refresh(teacher)
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(teacher.id), "email": teacher.email}, 
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"sub": str(teacher.id)}
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=TeacherResponse)
async def get_current_user(
    current_user: Teacher = Depends(get_current_active_teacher)
):
    """Get current user information"""
    return current_user


@router.get("/reauth/google")  
async def google_reauth():
    """Force re-authentication with Google to get updated permissions"""
    # Build Google OAuth URL directly with classroom permissions
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code", 
        "scope": " ".join(settings.GOOGLE_CLASSROOM_SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # Force consent to update permissions
        "state": secrets.token_urlsafe(32)
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?" + "&".join([f"{k}={v}" for k, v in params.items()])
    return RedirectResponse(url=auth_url)


# Student-specific authentication endpoints
@router.get("/student/login/google")
async def student_google_login(db: AsyncSession = Depends(get_db)):
    """Initiate Google OAuth2 login flow for students"""
    # # Check if Google OAuth is properly configured
    # if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID == "your-google-client-id":
    #     # For demo - simulate Google OAuth flow for students
    #     demo_student = {
    #         "id": "demo_student_456", 
    #         "email": "student@school.edu",
    #         "name": "Demo Student",
    #         "picture": "https://via.placeholder.com/96x96.png?text=ST"
    #     }
        
    #     try:
    #         # Check if student exists
    #         result = await db.execute(
    #             select(Student).where(Student.google_id == demo_student["id"])
    #         )
    #         student = result.scalar_one_or_none()
            
    #         if not student:
    #             # Create new student
    #             student = Student(
    #                 email=demo_student["email"],
    #                 google_id=demo_student["id"],
    #                 name=demo_student.get("name"),
    #                 avatar_url=demo_student.get("picture"),
    #                 is_active=True
    #             )
    #             db.add(student)
    #             await db.commit()
    #             await db.refresh(student)
            
    #         # Create student-specific JWT tokens
    #         access_token = create_access_token(
    #             data={"sub": str(student.id), "email": student.email, "role": "student"}
    #         )
    #         refresh_token = create_refresh_token(
    #             data={"sub": str(student.id), "role": "student"}
    #         )
            
    #         # Redirect to student portal with tokens and student data
    #         frontend_url = "http://localhost:3000"
    #         student_data = json.dumps({
    #             "id": str(student.id),
    #             "email": student.email,
    #             "name": student.name,
    #             "avatar_url": student.avatar_url
    #         })
    #         redirect_url = f"{frontend_url}/student-portal?student_data={student_data}&token={access_token}"
            
    #         return RedirectResponse(url=redirect_url)
            
    #     except Exception as e:
    #         # Redirect to student login with error
    #         frontend_url = "http://localhost:3000"
    #         error_url = f"{frontend_url}/student-login?error=oauth_failed"
    #         return RedirectResponse(url=error_url)
    
    # For production OAuth flow - use same callback as teachers but with student state
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,  # Use same callback as teachers
        "response_type": "code",
        "scope": " ".join(settings.GOOGLE_BASIC_SCOPES),  # Students only need basic profile access
        "access_type": "offline",
        "prompt": "select_account",
        "state": "student_login_" + secrets.token_urlsafe(32)  # Mark as student login
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?" + "&".join([f"{k}={v}" for k, v in params.items()])
    return RedirectResponse(url=auth_url)


