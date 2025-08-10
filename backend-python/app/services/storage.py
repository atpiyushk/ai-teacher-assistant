import os
import aiofiles
from pathlib import Path
from typing import Optional, BinaryIO
import uuid
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Handle file storage (local or S3)"""
    
    def __init__(self):
        self.use_s3 = settings.USE_S3
        
        if self.use_s3:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            self.bucket_name = settings.S3_BUCKET_NAME
        else:
            # Ensure local upload directory exists
            self.upload_dir = Path(settings.UPLOAD_DIR)
            self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    async def save_file(
        self, 
        file_content: bytes, 
        filename: str, 
        folder: str = "submissions"
    ) -> str:
        """Save file and return its path/URL"""
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        file_extension = Path(filename).suffix
        stored_filename = f"{timestamp}_{unique_id}{file_extension}"
        
        if self.use_s3:
            # Save to S3
            key = f"{folder}/{stored_filename}"
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=file_content,
                    ContentType=self._get_content_type(filename)
                )
                # Return S3 URL
                return f"s3://{self.bucket_name}/{key}"
            except ClientError as e:
                logger.error(f"S3 upload failed: {e}")
                raise Exception(f"Failed to upload file: {str(e)}")
        else:
            # Save locally
            folder_path = self.upload_dir / folder
            folder_path.mkdir(parents=True, exist_ok=True)
            
            file_path = folder_path / stored_filename
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_content)
            
            return str(file_path)
    
    async def get_file(self, file_path: str) -> bytes:
        """Retrieve file content"""
        if file_path.startswith("s3://"):
            # Get from S3
            bucket, key = self._parse_s3_path(file_path)
            try:
                response = self.s3_client.get_object(Bucket=bucket, Key=key)
                return response['Body'].read()
            except ClientError as e:
                logger.error(f"S3 download failed: {e}")
                raise Exception(f"Failed to download file: {str(e)}")
        else:
            # Get from local storage
            async with aiofiles.open(file_path, 'rb') as f:
                return await f.read()
    
    async def delete_file(self, file_path: str) -> bool:
        """Delete a file"""
        try:
            if file_path.startswith("s3://"):
                # Delete from S3
                bucket, key = self._parse_s3_path(file_path)
                self.s3_client.delete_object(Bucket=bucket, Key=key)
            else:
                # Delete local file
                os.remove(file_path)
            return True
        except Exception as e:
            logger.error(f"Failed to delete file: {e}")
            return False
    
    async def get_presigned_url(self, file_path: str, expiration: int = 3600) -> str:
        """Get a presigned URL for S3 files (or local file URL)"""
        if file_path.startswith("s3://"):
            bucket, key = self._parse_s3_path(file_path)
            try:
                url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket, 'Key': key},
                    ExpiresIn=expiration
                )
                return url
            except ClientError as e:
                logger.error(f"Failed to generate presigned URL: {e}")
                raise
        else:
            # For local files, return a URL that the API can serve
            # This assumes you have a file serving endpoint
            relative_path = Path(file_path).relative_to(settings.UPLOAD_DIR)
            return f"/api/v1/files/{relative_path}"
    
    def _get_content_type(self, filename: str) -> str:
        """Get content type based on file extension"""
        ext = Path(filename).suffix.lower()
        content_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.txt': 'text/plain',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        return content_types.get(ext, 'application/octet-stream')
    
    def _parse_s3_path(self, s3_path: str) -> tuple:
        """Parse S3 path into bucket and key"""
        # s3://bucket/folder/file.ext -> (bucket, folder/file.ext)
        parts = s3_path.replace("s3://", "").split("/", 1)
        if len(parts) != 2:
            raise ValueError(f"Invalid S3 path: {s3_path}")
        return parts[0], parts[1]


# Global instance
storage_service = StorageService()