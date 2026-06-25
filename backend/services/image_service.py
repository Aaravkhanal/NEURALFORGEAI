"""
NeuralForge — Image Service
Image-specific operations: corruption detection, duplicate finding,
quality assessment, standardization, and class balancing analysis.
"""

import os
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger("neuralforge.image")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"}


class ImageService:
    """Image processing utilities for dataset cleaning and preparation."""

    @staticmethod
    def get_image_info(image_path: str) -> Optional[dict]:
        """Get basic image information."""
        try:
            from PIL import Image
            with Image.open(image_path) as img:
                return {
                    "width": img.width,
                    "height": img.height,
                    "mode": img.mode,
                    "format": img.format,
                    "size_bytes": os.path.getsize(image_path),
                }
        except Exception as e:
            logger.debug(f"Cannot read image {image_path}: {e}")
            return None

    @staticmethod
    def detect_corrupt_images(image_paths: list[str]) -> list[str]:
        """
        Detect corrupt/broken images by attempting to fully load them.

        Returns: List of paths to corrupt images.
        """
        from PIL import Image
        corrupt = []
        for path in image_paths:
            try:
                with Image.open(path) as img:
                    img.load()  # Force full decode
            except Exception:
                corrupt.append(path)
        return corrupt

    @staticmethod
    def detect_duplicates(image_paths: list[str], threshold: int = 5) -> list[list[str]]:
        """
        Detect exact and near-duplicate images using perceptual hashing.

        Args:
            image_paths: List of image file paths.
            threshold: Hash distance threshold (0 = exact, higher = more permissive).

        Returns: List of groups of duplicate paths.
        """
        try:
            import imagehash
            from PIL import Image
        except ImportError:
            logger.warning("imagehash not installed, skipping duplicate detection")
            return []

        hashes = {}  # hash -> [paths]
        for path in image_paths:
            try:
                with Image.open(path) as img:
                    h = imagehash.phash(img)
                    # Find if any existing hash is close enough
                    matched = False
                    for existing_hash, paths in hashes.items():
                        if abs(h - existing_hash) <= threshold:
                            paths.append(path)
                            matched = True
                            break
                    if not matched:
                        hashes[h] = [path]
            except Exception:
                continue

        # Return only groups with duplicates
        return [paths for paths in hashes.values() if len(paths) > 1]

    @staticmethod
    def assess_quality(image_paths: list[str]) -> dict:
        """
        Assess image quality: blur, exposure, noise, resolution.

        Returns: {
            "blurry": [paths...],
            "overexposed": [paths...],
            "underexposed": [paths...],
            "low_resolution": [paths...],
            "noisy": [paths...]
        }
        """
        result = {
            "blurry": [],
            "overexposed": [],
            "underexposed": [],
            "low_resolution": [],
            "noisy": [],
        }

        try:
            import cv2
            import numpy as np
        except ImportError:
            logger.warning("opencv not installed, skipping quality assessment")
            return result

        for path in image_paths:
            try:
                img = cv2.imread(path)
                if img is None:
                    continue

                h, w = img.shape[:2]
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

                # Blur detection (Laplacian variance)
                laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
                if laplacian_var < 100:
                    result["blurry"].append(path)

                # Exposure analysis
                mean_brightness = gray.mean()
                if mean_brightness > 240:
                    result["overexposed"].append(path)
                elif mean_brightness < 15:
                    result["underexposed"].append(path)

                # Low resolution
                if w < 64 or h < 64:
                    result["low_resolution"].append(path)

                # Noise estimation (using Laplacian)
                noise_level = np.sqrt(np.mean((gray.astype(float) - cv2.GaussianBlur(gray, (5, 5), 0).astype(float)) ** 2))
                if noise_level > 30:
                    result["noisy"].append(path)

            except Exception as e:
                logger.debug(f"Quality check failed for {path}: {e}")

        return result

    @staticmethod
    def resize_images(
        image_dir: str,
        output_dir: str,
        target_size: tuple[int, int] = (224, 224),
        maintain_aspect: bool = False,
    ) -> dict:
        """
        Resize all images in a directory to target dimensions.

        Returns: {"processed": int, "errors": int, "output_dir": str}
        """
        from PIL import Image

        os.makedirs(output_dir, exist_ok=True)
        processed = 0
        errors = 0

        for root, dirs, files in os.walk(image_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]
            rel_root = os.path.relpath(root, image_dir)
            out_root = os.path.join(output_dir, rel_root) if rel_root != "." else output_dir
            os.makedirs(out_root, exist_ok=True)

            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in IMAGE_EXTENSIONS and not f.startswith("."):
                    src = os.path.join(root, f)
                    dst = os.path.join(out_root, f)
                    try:
                        with Image.open(src) as img:
                            if maintain_aspect:
                                img.thumbnail(target_size, Image.Resampling.LANCZOS)
                            else:
                                img = img.resize(target_size, Image.Resampling.LANCZOS)
                            # Convert to RGB if necessary
                            if img.mode in ("RGBA", "P"):
                                img = img.convert("RGB")
                            img.save(dst)
                            processed += 1
                    except Exception as e:
                        logger.debug(f"Resize failed for {src}: {e}")
                        errors += 1

        return {"processed": processed, "errors": errors, "output_dir": output_dir}

    @staticmethod
    def convert_format(
        image_dir: str,
        output_dir: str,
        target_format: str = "png",
    ) -> dict:
        """Convert all images to a target format."""
        from PIL import Image

        os.makedirs(output_dir, exist_ok=True)
        processed = 0
        errors = 0

        for root, dirs, files in os.walk(image_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]
            rel_root = os.path.relpath(root, image_dir)
            out_root = os.path.join(output_dir, rel_root) if rel_root != "." else output_dir
            os.makedirs(out_root, exist_ok=True)

            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in IMAGE_EXTENSIONS and not f.startswith("."):
                    src = os.path.join(root, f)
                    new_name = os.path.splitext(f)[0] + f".{target_format}"
                    dst = os.path.join(out_root, new_name)
                    try:
                        with Image.open(src) as img:
                            if img.mode in ("RGBA", "P") and target_format.lower() in ("jpg", "jpeg"):
                                img = img.convert("RGB")
                            img.save(dst, format=target_format.upper().replace("JPG", "JPEG"))
                            processed += 1
                    except Exception as e:
                        logger.debug(f"Convert failed for {src}: {e}")
                        errors += 1

        return {"processed": processed, "errors": errors, "output_dir": output_dir}

    @staticmethod
    def remove_files(file_paths: list[str]) -> dict:
        """Remove specific files (corrupt, duplicates, etc.)."""
        removed = 0
        errors = 0
        for path in file_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    removed += 1
            except Exception:
                errors += 1
        return {"removed": removed, "errors": errors}

    @staticmethod
    def get_class_balance_recommendations(classes: dict) -> dict:
        """
        Analyze class distribution and provide balancing recommendations.
        """
        import numpy as np

        counts = list(classes.values())
        if not counts:
            return {"balanced": True, "recommendations": []}

        avg = np.mean(counts)
        std = np.std(counts)
        recommendations = []

        for cls, count in classes.items():
            ratio = count / avg if avg > 0 else 0
            if ratio < 0.5:
                recommendations.append({
                    "class": cls,
                    "count": count,
                    "status": "underrepresented",
                    "suggestion": "augmentation",
                    "detail": f"Consider data augmentation or oversampling. Has {count} samples vs average of {int(avg)}.",
                })
            elif ratio > 2.0:
                recommendations.append({
                    "class": cls,
                    "count": count,
                    "status": "overrepresented",
                    "suggestion": "undersampling",
                    "detail": f"Consider undersampling. Has {count} samples vs average of {int(avg)}.",
                })

        return {
            "balanced": len(recommendations) == 0,
            "total_classes": len(classes),
            "avg_samples_per_class": int(avg),
            "std_deviation": round(float(std), 1),
            "recommendations": recommendations,
        }
