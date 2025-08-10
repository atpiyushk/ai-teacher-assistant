from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn
from typing import List, Optional
import uuid
import os
import shutil
from datetime import datetime
import asyncio
from concurrent.futures import ProcessPoolExecutor
import logging

from surya.ocr import run_ocr
from surya.model.detection import segformer
from surya.model.recognition import load_model, load_processor
from surya.languages import LANGUAGE_MAP
from PIL import Image
import pypdf

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Surya OCR Service", version="1.0.0")

# Global models
det_model = None
rec_model = None
rec_processor = None
executor = ProcessPoolExecutor(max_workers=4)

# Temporary storage
TEMP_DIR = "/app/temp"
os.makedirs(TEMP_DIR, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Load OCR models on startup"""
    global det_model, rec_model, rec_processor
    logger.info("Loading Surya OCR models...")
    
    try:
        det_model = segformer.load_model()
        det_processor = segformer.load_processor()
        rec_model = load_model()
        rec_processor = load_processor()
        logger.info("OCR models loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load OCR models: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    executor.shutdown(wait=True)


def process_image_ocr(image_path: str, languages: List[str] = ["en"]) -> dict:
    """Process a single image with OCR"""
    try:
        image = Image.open(image_path)
        
        # Run OCR
        predictions = run_ocr(
            [image], 
            [languages], 
            det_model, 
            det_processor,
            rec_model, 
            rec_processor
        )
        
        if predictions and len(predictions) > 0:
            result = predictions[0]
            
            # Extract text and bounding boxes
            ocr_result = {
                "text": "",
                "lines": [],
                "confidence": 0.0
            }
            
            for text_line in result.text_lines:
                line_text = text_line.text
                ocr_result["text"] += line_text + "\n"
                ocr_result["lines"].append({
                    "text": line_text,
                    "bbox": text_line.bbox,
                    "confidence": getattr(text_line, 'confidence', 0.95)
                })
            
            ocr_result["text"] = ocr_result["text"].strip()
            return ocr_result
        
        return {"text": "", "lines": [], "confidence": 0.0}
        
    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise


def extract_images_from_pdf(pdf_path: str) -> List[str]:
    """Extract images from PDF pages"""
    image_paths = []
    
    try:
        with open(pdf_path, 'rb') as file:
            reader = pypdf.PdfReader(file)
            
            for page_num, page in enumerate(reader.pages):
                # Convert PDF page to image
                # Note: In production, you'd use pdf2image or similar
                # For now, we'll extract embedded images
                if '/XObject' in page['/Resources']:
                    xObject = page['/Resources']['/XObject'].get_object()
                    
                    for obj in xObject:
                        if xObject[obj]['/Subtype'] == '/Image':
                            size = (xObject[obj]['/Width'], xObject[obj]['/Height'])
                            data = xObject[obj].get_data()
                            
                            # Save image
                            img_path = f"{TEMP_DIR}/page_{page_num}_{obj}.png"
                            with open(img_path, 'wb') as img_file:
                                img_file.write(data)
                            image_paths.append(img_path)
    
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise
    
    return image_paths


@app.post("/ocr/process")
async def process_ocr(
    file: UploadFile = File(...),
    languages: Optional[List[str]] = ["en"],
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Process a file (image or PDF) with OCR"""
    
    # Validate file type
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.pdf', '.bmp', '.gif')):
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    temp_path = f"{TEMP_DIR}/{job_id}_{file.filename}"
    
    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process based on file type
        if file.filename.lower().endswith('.pdf'):
            # Extract images from PDF
            image_paths = extract_images_from_pdf(temp_path)
            
            # Process each image
            results = []
            for img_path in image_paths:
                result = await asyncio.get_event_loop().run_in_executor(
                    executor, process_image_ocr, img_path, languages
                )
                results.append(result)
                
                # Cleanup temp image
                os.remove(img_path)
            
            # Combine results
            combined_text = "\n\n".join([r["text"] for r in results])
            ocr_result = {
                "job_id": job_id,
                "status": "completed",
                "file_type": "pdf",
                "pages": len(results),
                "text": combined_text,
                "page_results": results,
                "processed_at": datetime.utcnow().isoformat()
            }
        
        else:
            # Process single image
            result = await asyncio.get_event_loop().run_in_executor(
                executor, process_image_ocr, temp_path, languages
            )
            
            ocr_result = {
                "job_id": job_id,
                "status": "completed",
                "file_type": "image",
                "text": result["text"],
                "lines": result["lines"],
                "confidence": result["confidence"],
                "processed_at": datetime.utcnow().isoformat()
            }
        
        # Cleanup
        background_tasks.add_task(cleanup_file, temp_path)
        
        return ocr_result
        
    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        # Cleanup on error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ocr/status/{job_id}")
async def get_ocr_status(job_id: str):
    """Get OCR job status (placeholder for async processing)"""
    return {
        "job_id": job_id,
        "status": "completed",
        "message": "Synchronous processing - job completed immediately"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "surya-ocr",
        "models_loaded": det_model is not None and rec_model is not None
    }


def cleanup_file(filepath: str):
    """Remove temporary file"""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        logger.error(f"Failed to cleanup {filepath}: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)