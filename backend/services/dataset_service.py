"""
NeuralForge — Dataset Service
Universal dataset profiling, validation, and type detection.
Handles text, image, and tabular datasets.
"""

import os
import io
import zipfile
import logging
from typing import Optional
from pathlib import Path

import pandas as pd
import numpy as np

logger = logging.getLogger("neuralforge.dataset")

# Supported file extensions by type
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"}
TEXT_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".txt"}
ARCHIVE_EXTENSIONS = {".zip"}

SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | TEXT_EXTENSIONS | ARCHIVE_EXTENSIONS


class DatasetService:
    """Handles dataset upload validation, type detection, and profiling."""

    @staticmethod
    def detect_dataset_type(filename: str, file_path: str) -> str:
        """
        Auto-detect whether a file is a text, image, or tabular dataset.

        Returns: 'text' | 'image' | 'tabular'
        """
        ext = os.path.splitext(filename)[1].lower()

        # ZIP archives are assumed to be image datasets (class folders)
        if ext in ARCHIVE_EXTENSIONS:
            return "image"

        # Direct image files
        if ext in IMAGE_EXTENSIONS:
            return "image"

        # TXT files are text datasets
        if ext == ".txt":
            return "text"

        # CSV/XLSX/JSON — inspect content to determine if text or tabular
        if ext in {".csv", ".xlsx", ".xls", ".json"}:
            try:
                df = DatasetService._load_dataframe(file_path, ext)
                if df is None or df.empty:
                    return "tabular"

                # If most columns are object/string and there are < 5 columns,
                # likely a text dataset
                object_cols = df.select_dtypes(include=["object", "string"]).columns
                numeric_cols = df.select_dtypes(include=["number"]).columns

                if len(object_cols) >= len(df.columns) * 0.7 and len(df.columns) <= 5:
                    # Check if any column has long text (avg > 50 chars)
                    for col in object_cols:
                        avg_len = df[col].dropna().astype(str).str.len().mean()
                        if avg_len > 50:
                            return "text"
                return "tabular"
            except Exception:
                return "tabular"

        return "tabular"

    @staticmethod
    def validate_upload(filename: str, content: bytes, max_size_mb: int = 500) -> dict:
        """
        Validate an uploaded file.

        Returns: {"valid": bool, "errors": [...], "warnings": [...]}
        """
        result = {"valid": True, "errors": [], "warnings": []}
        ext = os.path.splitext(filename)[1].lower()

        # Check extension
        if ext not in SUPPORTED_EXTENSIONS:
            result["valid"] = False
            result["errors"].append(
                f"Unsupported file type: {ext}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )
            return result

        # Check file size
        file_size_mb = len(content) / (1024 * 1024)
        if file_size_mb > max_size_mb:
            result["valid"] = False
            result["errors"].append(f"File too large: {file_size_mb:.1f}MB (max: {max_size_mb}MB)")
            return result

        # Check for corrupt files
        if ext in ARCHIVE_EXTENSIONS:
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    bad = zf.testzip()
                    if bad:
                        result["warnings"].append(f"Corrupt file found in archive: {bad}")
            except zipfile.BadZipFile:
                result["valid"] = False
                result["errors"].append("Corrupt ZIP archive — file cannot be opened.")
                return result

        elif ext in {".csv"}:
            try:
                pd.read_csv(io.BytesIO(content), nrows=5)
            except Exception as e:
                result["valid"] = False
                result["errors"].append(f"Corrupt CSV file: {e}")
                return result

        elif ext in {".xlsx", ".xls"}:
            try:
                pd.read_excel(io.BytesIO(content), nrows=5)
            except Exception as e:
                result["valid"] = False
                result["errors"].append(f"Corrupt Excel file: {e}")
                return result

        elif ext == ".json":
            try:
                pd.read_json(io.BytesIO(content))
            except Exception as e:
                result["valid"] = False
                result["errors"].append(f"Corrupt JSON file: {e}")
                return result

        elif ext in IMAGE_EXTENSIONS:
            try:
                from PIL import Image
                img = Image.open(io.BytesIO(content))
                img.verify()
            except Exception as e:
                result["valid"] = False
                result["errors"].append(f"Corrupt image file: {e}")
                return result

        return result

    @staticmethod
    def extract_zip(zip_path: str, extract_to: str) -> dict:
        """
        Extract a ZIP archive and detect folder structure.

        Returns: {
            "extracted_path": str,
            "total_files": int,
            "classes": {"class_name": file_count},
            "structure": "class_folders" | "flat"
        }
        """
        os.makedirs(extract_to, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_to)

        # Detect class folder structure
        classes = {}
        total_files = 0
        structure = "flat"

        # Walk the extracted directory
        for root, dirs, files in os.walk(extract_to):
            # Skip __MACOSX and hidden directories
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]

            image_files = [
                f for f in files
                if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS and not f.startswith(".")
            ]

            if image_files:
                # Get relative class name from folder
                rel_path = os.path.relpath(root, extract_to)
                if rel_path != ".":
                    class_name = rel_path.split(os.sep)[0]
                    # Skip if the class_name is just the archive name wrapper
                    parts = rel_path.split(os.sep)
                    if len(parts) >= 2:
                        class_name = parts[-1]
                    classes[class_name] = classes.get(class_name, 0) + len(image_files)
                    structure = "class_folders"
                else:
                    classes["unlabeled"] = classes.get("unlabeled", 0) + len(image_files)
                total_files += len(image_files)

        return {
            "extracted_path": extract_to,
            "total_files": total_files,
            "classes": classes,
            "structure": structure,
        }

    @staticmethod
    def profile_text_dataset(file_path: str, ext: str) -> dict:
        """Generate profiling report for text datasets."""
        df = DatasetService._load_dataframe(file_path, ext)
        if df is None:
            return {"error": "Could not load dataset"}

        report = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "dataset_size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
            "columns": [],
            "missing_values": {},
            "duplicate_records": {
                "count": int(df.duplicated().sum()),
                "percentage": round(df.duplicated().mean() * 100, 2),
            },
            "text_length_distribution": {},
            "label_distribution": {},
            "null_columns": [],
        }

        # Column-level analysis
        for col in df.columns:
            col_info = {
                "name": col,
                "dtype": str(df[col].dtype),
                "non_null_count": int(df[col].notna().sum()),
                "null_count": int(df[col].isna().sum()),
                "null_percentage": round(df[col].isna().mean() * 100, 2),
                "unique_count": int(df[col].nunique()),
            }

            if df[col].isna().any():
                report["missing_values"][col] = {
                    "count": int(df[col].isna().sum()),
                    "percentage": round(df[col].isna().mean() * 100, 2),
                }

            if df[col].isna().all():
                report["null_columns"].append(col)

            # Text length for string columns
            if df[col].dtype == "object":
                lengths = df[col].dropna().astype(str).str.len()
                col_info["avg_length"] = round(float(lengths.mean()), 1) if len(lengths) > 0 else 0
                col_info["max_length"] = int(lengths.max()) if len(lengths) > 0 else 0
                col_info["min_length"] = int(lengths.min()) if len(lengths) > 0 else 0

                # If this looks like a label column (low unique count)
                if df[col].nunique() < 50 and df[col].nunique() > 1:
                    report["label_distribution"][col] = (
                        df[col].value_counts().head(20).to_dict()
                    )

                # Text length distribution (binned)
                if len(lengths) > 0 and lengths.mean() > 20:
                    hist, edges = np.histogram(lengths, bins=10)
                    report["text_length_distribution"][col] = {
                        "bins": [round(float(e), 1) for e in edges],
                        "counts": [int(h) for h in hist],
                    }

            report["columns"].append(col_info)

        return report

    @staticmethod
    def profile_tabular_dataset(file_path: str, ext: str) -> dict:
        """Generate profiling report for tabular datasets."""
        df = DatasetService._load_dataframe(file_path, ext)
        if df is None:
            return {"error": "Could not load dataset"}

        report = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "dataset_size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
            "columns": [],
            "missing_values": {},
            "duplicate_rows": {
                "count": int(df.duplicated().sum()),
                "percentage": round(df.duplicated().mean() * 100, 2),
            },
            "data_types": {str(k): int(v) for k, v in df.dtypes.value_counts().items()},
            "statistics": {},
            "correlations": None,
            "outliers": {},
            "feature_distributions": {},
            "sample_data": df.head(10).fillna("").to_dict(orient="records"),
        }

        # Column-level analysis
        for col in df.columns:
            col_info = {
                "name": col,
                "dtype": str(df[col].dtype),
                "non_null_count": int(df[col].notna().sum()),
                "null_count": int(df[col].isna().sum()),
                "null_percentage": round(df[col].isna().mean() * 100, 2),
                "unique_count": int(df[col].nunique()),
            }

            if df[col].isna().any():
                report["missing_values"][col] = {
                    "count": int(df[col].isna().sum()),
                    "percentage": round(df[col].isna().mean() * 100, 2),
                }

            # Numeric statistics
            if pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                if len(series) > 0:
                    col_info.update({
                        "mean": round(float(series.mean()), 4),
                        "std": round(float(series.std()), 4),
                        "min": float(series.min()),
                        "max": float(series.max()),
                        "median": float(series.median()),
                        "q1": float(series.quantile(0.25)),
                        "q3": float(series.quantile(0.75)),
                    })

                    # Outlier detection (IQR method)
                    q1 = series.quantile(0.25)
                    q3 = series.quantile(0.75)
                    iqr = q3 - q1
                    lower = q1 - 1.5 * iqr
                    upper = q3 + 1.5 * iqr
                    outlier_count = int(((series < lower) | (series > upper)).sum())
                    if outlier_count > 0:
                        report["outliers"][col] = {
                            "count": outlier_count,
                            "percentage": round(outlier_count / len(series) * 100, 2),
                            "lower_bound": round(float(lower), 4),
                            "upper_bound": round(float(upper), 4),
                        }

                    # Feature distribution (histogram)
                    hist, edges = np.histogram(series, bins=min(20, len(series.unique())))
                    report["feature_distributions"][col] = {
                        "bins": [round(float(e), 4) for e in edges],
                        "counts": [int(h) for h in hist],
                    }

            # Categorical column stats
            elif df[col].dtype == "object" and df[col].nunique() < 50:
                col_info["top_values"] = df[col].value_counts().head(10).to_dict()

            report["columns"].append(col_info)

        # Column statistics
        desc = df.describe(include="all")
        for col in desc.columns:
            report["statistics"][col] = {
                k: str(v) for k, v in desc[col].dropna().items()
            }

        # Correlation matrix (numeric only)
        numeric_df = df.select_dtypes(include=["number"])
        if len(numeric_df.columns) > 1:
            corr = numeric_df.corr()
            report["correlations"] = {
                col: {k: round(float(v), 4) for k, v in corr[col].items()}
                for col in corr.columns
            }

        return report

    @staticmethod
    def profile_image_dataset(extracted_path: str, classes: dict) -> dict:
        """Generate profiling report for image datasets. Uses image_service for heavy lifting."""
        from services.image_service import ImageService

        report = {
            "total_images": sum(classes.values()),
            "num_classes": len(classes),
            "classes": classes,
            "dataset_size_mb": 0,
            "resolution_distribution": {},
            "format_distribution": {},
            "class_imbalance_report": {},
            "corrupt_images": [],
            "duplicate_groups": [],
            "quality_report": {"blurry": [], "overexposed": [], "underexposed": []},
        }

        # Calculate total size and gather image info
        image_paths = []
        resolutions = {}
        formats = {}

        for root, dirs, files in os.walk(extracted_path):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in IMAGE_EXTENSIONS and not f.startswith("."):
                    fpath = os.path.join(root, f)
                    image_paths.append(fpath)

                    try:
                        size = os.path.getsize(fpath)
                        report["dataset_size_mb"] += size
                    except OSError:
                        pass

                    # Format distribution
                    fmt = ext.lstrip(".")
                    formats[fmt] = formats.get(fmt, 0) + 1

        report["dataset_size_mb"] = round(report["dataset_size_mb"] / (1024 * 1024), 2)
        report["format_distribution"] = formats

        # Resolution distribution and quality checks (sample if too many)
        sample_paths = image_paths[:500] if len(image_paths) > 500 else image_paths
        for fpath in sample_paths:
            try:
                info = ImageService.get_image_info(fpath)
                if info:
                    res_key = f"{info['width']}x{info['height']}"
                    resolutions[res_key] = resolutions.get(res_key, 0) + 1
            except Exception:
                report["corrupt_images"].append(fpath)

        report["resolution_distribution"] = dict(
            sorted(resolutions.items(), key=lambda x: x[1], reverse=True)[:20]
        )

        # Class imbalance
        if classes:
            counts = list(classes.values())
            avg_count = np.mean(counts)
            for cls, count in classes.items():
                ratio = count / avg_count if avg_count > 0 else 0
                if ratio < 0.5:
                    report["class_imbalance_report"][cls] = {
                        "count": count,
                        "status": "underrepresented",
                        "ratio": round(ratio, 2),
                    }
                elif ratio > 2.0:
                    report["class_imbalance_report"][cls] = {
                        "count": count,
                        "status": "overrepresented",
                        "ratio": round(ratio, 2),
                    }

        # Corrupt image detection (full scan)
        corrupt = ImageService.detect_corrupt_images(image_paths)
        report["corrupt_images"] = corrupt

        # Duplicate detection (sample for performance)
        dup_paths = image_paths[:1000] if len(image_paths) > 1000 else image_paths
        report["duplicate_groups"] = ImageService.detect_duplicates(dup_paths)

        # Quality assessment (sample)
        quality_paths = image_paths[:200] if len(image_paths) > 200 else image_paths
        report["quality_report"] = ImageService.assess_quality(quality_paths)

        return report

    @staticmethod
    def get_dataset_summary(file_path: str, dataset_type: str, ext: str) -> dict:
        """Quick summary for display after upload."""
        summary = {
            "type": dataset_type,
            "file_size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
        }

        if dataset_type == "tabular" or dataset_type == "text":
            df = DatasetService._load_dataframe(file_path, ext)
            if df is not None:
                summary["rows"] = len(df)
                summary["columns"] = len(df.columns)
                summary["column_names"] = list(df.columns)
                summary["dtypes"] = {str(k): int(v) for k, v in df.dtypes.value_counts().items()}

        return summary

    @staticmethod
    def _load_dataframe(file_path: str, ext: str) -> Optional[pd.DataFrame]:
        """Load a file into a pandas DataFrame."""
        try:
            if ext in (".csv", "csv"):
                return pd.read_csv(file_path)
            elif ext in (".xlsx", ".xls", "xlsx", "xls"):
                return pd.read_excel(file_path)
            elif ext in (".json", "json"):
                return pd.read_json(file_path)
            elif ext in (".txt", "txt"):
                # Try CSV first, then line-by-line
                try:
                    return pd.read_csv(file_path, sep="\t")
                except Exception:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                    return pd.DataFrame({"text": [l.strip() for l in lines if l.strip()]})
        except Exception as e:
            logger.error(f"Error loading dataframe from {file_path}: {e}")
            return None
        return None
