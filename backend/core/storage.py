"""
NeuralForge Backend — Storage Abstraction Layer
Supports Local filesystem, AWS S3, and MinIO storage.
"""

import os
import shutil
from pathlib import Path
from typing import Optional

from core.config import get_settings

settings = get_settings()

try:
    import boto3
    from botocore.client import Config
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class StorageBackend:
    """Abstract base class for storage."""
    def save(self, file_data: bytes, path: str) -> str:
        raise NotImplementedError

    def load(self, path: str) -> bytes:
        raise NotImplementedError

    def get_url(self, path: str) -> str:
        raise NotImplementedError


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, file_data: bytes, path: str) -> str:
        full_path = self.base_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(file_data)
        return str(full_path)

    def load(self, path: str) -> bytes:
        with open(self.base_dir / path, "rb") as f:
            return f.read()

    def get_url(self, path: str) -> str:
        return f"local://{path}"


class S3Storage(StorageBackend):
    def __init__(self, bucket: str, endpoint_url: Optional[str] = None):
        if not BOTO3_AVAILABLE:
            raise ImportError("boto3 is required for S3/MinIO storage. Run `pip install boto3`.")
            
        self.bucket = bucket
        self.client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            config=Config(signature_version='s3v4')
        )

    def save(self, file_data: bytes, path: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=path, Body=file_data)
        return f"s3://{self.bucket}/{path}"

    def load(self, path: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=path)
        return response['Body'].read()

    def get_url(self, path: str) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': path},
            ExpiresIn=3600
        )


def get_storage() -> StorageBackend:
    """Factory to get the configured storage backend."""
    if getattr(settings, "storage_backend", "local") == "s3":
        return S3Storage(
            bucket=getattr(settings, "s3_bucket", "neuralforge-models"),
            endpoint_url=getattr(settings, "s3_endpoint_url", None)
        )
    return LocalStorage(base_dir=settings.model_storage_dir)

storage = get_storage()
