from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Optional
import uuid
import os
import shutil
from datetime import datetime
import asyncio
import logging
import base64
import io
from PIL import Image
import pdf2image

from google.cloud import vision
from google.cloud.vision_v1 import types
import google.auth
from google.auth.transport.requests import Request
from google.auth import exceptions as auth_exceptions

router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

# Global Vision client
vision_client = None

def get_vision_client():
    """Get or create Google Vision API client"""
    global vision_client
    if vision_client is None:
        try:
            # First try to use Application Default Credentials
            try:
                vision_client = vision.ImageAnnotatorClient()
                logger.info("Google Vision API client initialized with ADC")
            except auth_exceptions.DefaultCredentialsError:
                # Fallback: Use API key if available
                api_key = os.getenv('GOOGLE_VISION_API_KEY')
                if api_key and api_key != 'your-google-vision-api-key':
                    # For API key authentication, we'd need to use REST API directly
                    # For now, log the issue and provide guidance
                    logger.warning("Google Vision requires service account credentials")
                    raise HTTPException(
                        status_code=503, 
                        detail="OCR service requires Google Cloud service account credentials"
                    )
                else:
                    logger.warning("No Google Vision API credentials found")
                    raise HTTPException(
                        status_code=503, 
                        detail="OCR service not configured - missing credentials"
                    )
        except Exception as e:
            logger.error(f"Failed to initialize Google Vision API client: {e}")
            raise HTTPException(status_code=503, detail="OCR service unavailable")
    return vision_client

def convert_pdf_to_images(pdf_path: str) -> List[str]:
    """Convert PDF pages to images"""
    try:
        # Convert PDF to images
        images = pdf2image.convert_from_path(pdf_path)
        image_paths = []
        
        for i, image in enumerate(images):
            image_path = f"{pdf_path}_page_{i}.png"
            image.save(image_path, 'PNG')
            image_paths.append(image_path)
            
        return image_paths
    except Exception as e:
        logger.error(f"Failed to convert PDF to images: {e}")
        raise HTTPException(status_code=500, detail="Failed to process PDF")

def process_image_with_vision(image_path: str) -> dict:
    """Process a single image with Google Vision API"""
    try:
        client = get_vision_client()
        
        # Read image file
        with io.open(image_path, 'rb') as image_file:
            content = image_file.read()
        
        # Create Vision API image object
        image = vision.Image(content=content)
        
        # Perform text detection
        response = client.text_detection(image=image)
        texts = response.text_annotations
        
        if response.error.message:
            raise Exception(f"Vision API error: {response.error.message}")
        
        # Extract text and annotations
        result = {
            "text": "",
            "lines": [],
            "confidence": 0.0
        }
        
        if texts:
            # First annotation contains the entire detected text
            result["text"] = texts[0].description
            
            # Individual text annotations
            for text in texts[1:]:  # Skip the first one as it's the full text
                vertices = [(vertex.x, vertex.y) for vertex in text.bounding_poly.vertices]
                result["lines"].append({
                    "text": text.description,
                    "bbox": vertices,
                    "confidence": 0.95  # Vision API doesn't provide confidence scores for text detection
                })
            
            result["confidence"] = 0.95
        
        return result
        
    except Exception as e:
        logger.error(f"Vision API processing error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@router.post("/process")
async def process_ocr(
    file: UploadFile = File(...),
    languages: Optional[List[str]] = ["en"],
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Process a file (image or PDF) with Google Vision OCR"""
    
    # Validate file type
    allowed_types = ['.png', '.jpg', '.jpeg', '.pdf', '.bmp', '.gif', '.tiff', '.webp']
    if not any(file.filename.lower().endswith(ext) for ext in allowed_types):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Generate job ID and temp path
    job_id = str(uuid.uuid4())
    uploads_dir = "/tmp/ocr_uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    temp_path = f"{uploads_dir}/{job_id}_{file.filename}"
    
    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Processing file: {file.filename} (Job ID: {job_id})")
        
        # Process based on file type
        if file.filename.lower().endswith('.pdf'):
            # Convert PDF to images and process each page
            image_paths = convert_pdf_to_images(temp_path)
            
            results = []
            for i, img_path in enumerate(image_paths):
                try:
                    result = process_image_with_vision(img_path)
                    results.append({
                        "page": i + 1,
                        "text": result["text"],
                        "lines": result["lines"],
                        "confidence": result["confidence"]
                    })
                except Exception as e:
                    logger.error(f"Failed to process page {i+1}: {e}")
                    results.append({
                        "page": i + 1,
                        "text": "",
                        "lines": [],
                        "confidence": 0.0,
                        "error": str(e)
                    })
                finally:
                    # Clean up page image
                    if os.path.exists(img_path):
                        os.remove(img_path)
            
            # Combine all page texts
            combined_text = "\n\n".join([r["text"] for r in results if r["text"]])
            
            ocr_result = {
                "job_id": job_id,
                "status": "completed",
                "file_type": "pdf",
                "filename": file.filename,
                "pages": len(results),
                "text": combined_text,
                "page_results": results,
                "processed_at": datetime.utcnow().isoformat(),
                "language": languages[0] if languages else "en"
            }
        
        else:
            # Process single image
            result = process_image_with_vision(temp_path)
            
            ocr_result = {
                "job_id": job_id,
                "status": "completed",
                "file_type": "image",
                "filename": file.filename,
                "text": result["text"],
                "lines": result["lines"],
                "confidence": result["confidence"],
                "processed_at": datetime.utcnow().isoformat(),
                "language": languages[0] if languages else "en"
            }
        
        # Schedule cleanup
        background_tasks.add_task(cleanup_file, temp_path)
        
        logger.info(f"OCR processing completed for job {job_id}")
        return ocr_result
        
    except HTTPException:
        # Re-raise HTTP exceptions
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    except Exception as e:
        logger.error(f"OCR processing failed for job {job_id}: {e}")
        # Cleanup on error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@router.get("/status/{job_id}")
async def get_ocr_status(job_id: str):
    """Get OCR job status (for synchronous processing, always completed)"""
    return {
        "job_id": job_id,
        "status": "completed",
        "message": "Synchronous processing - job completed immediately"
    }

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Vision API connectivity
        client = get_vision_client()
        return {
            "status": "healthy",
            "service": "google-vision-ocr",
            "vision_api_available": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "google-vision-ocr", 
            "vision_api_available": False,
            "error": str(e)
        }

def cleanup_file(filepath: str):
    """Remove temporary file"""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Cleaned up temporary file: {filepath}")
    except Exception as e:
        logger.error(f"Failed to cleanup {filepath}: {e}")