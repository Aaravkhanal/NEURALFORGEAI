"""
NeuralForge — Cleaning Service
Orchestrates data cleaning pipelines for text, image, and tabular datasets.
"""

import os
import shutil
import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger("neuralforge.cleaning")


class CleaningService:
    """Orchestrates all cleaning pipelines across dataset types."""

    # ─── TABULAR CLEANING ──────────────────────────────────────────

    @staticmethod
    def clean_tabular(file_path: str, ext: str, operations: list[dict]) -> dict:
        """
        Apply a sequence of cleaning operations to a tabular dataset.

        Returns: {"success": bool, "output_path": str, "rows": int, "columns": int, "report": {...}}
        """
        df = CleaningService._load_df(file_path, ext)
        if df is None:
            return {"success": False, "error": "Could not load dataset"}

        report = {"operations_applied": [], "rows_before": len(df), "columns_before": len(df.columns)}

        for op in operations:
            op_type = op.get("type")
            col = op.get("column")
            result = {"type": op_type, "column": col, "status": "success"}

            try:
                if op_type == "impute":
                    strategy = op.get("strategy", "mean")
                    if col and col in df.columns:
                        if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                            df[col] = df[col].fillna(df[col].mean())
                        elif strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
                            df[col] = df[col].fillna(df[col].median())
                        elif strategy == "mode":
                            df[col] = df[col].fillna(df[col].mode().iloc[0] if len(df[col].mode()) > 0 else "")
                        elif strategy == "zero":
                            df[col] = df[col].fillna(0)
                        elif strategy == "forward_fill":
                            df[col] = df[col].ffill()
                        elif strategy == "backward_fill":
                            df[col] = df[col].bfill()
                        elif strategy == "knn":
                            try:
                                from sklearn.impute import KNNImputer
                                numeric_cols = df.select_dtypes(include=["number"]).columns
                                if col in numeric_cols:
                                    imputer = KNNImputer(n_neighbors=5)
                                    df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
                            except ImportError:
                                result["status"] = "skipped"
                                result["detail"] = "sklearn not available for KNN imputation"
                        result["detail"] = f"Imputed {col} using {strategy}"

                elif op_type == "drop_column":
                    if col and col in df.columns:
                        df = df.drop(columns=[col])
                        result["detail"] = f"Dropped column {col}"

                elif op_type == "drop_rows":
                    if col and col in df.columns:
                        before = len(df)
                        df = df.dropna(subset=[col])
                        result["detail"] = f"Dropped {before - len(df)} rows with null {col}"

                elif op_type == "drop_duplicates":
                    before = len(df)
                    df = df.drop_duplicates()
                    result["detail"] = f"Removed {before - len(df)} duplicate rows"

                elif op_type == "handle_outliers":
                    method = op.get("method", "iqr")
                    action = op.get("action", "clip")  # clip | remove
                    if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        if method == "iqr":
                            q1 = df[col].quantile(0.25)
                            q3 = df[col].quantile(0.75)
                            iqr = q3 - q1
                            lower = q1 - 1.5 * iqr
                            upper = q3 + 1.5 * iqr
                        elif method == "zscore":
                            mean = df[col].mean()
                            std = df[col].std()
                            lower = mean - 3 * std
                            upper = mean + 3 * std
                        elif method == "isolation_forest":
                            try:
                                from sklearn.ensemble import IsolationForest
                                iso = IsolationForest(contamination=op.get("contamination", 0.05), random_state=42)
                                mask = iso.fit_predict(df[[col]].fillna(df[col].median())) == 1
                                if action == "remove":
                                    before = len(df)
                                    df = df[mask]
                                    result["detail"] = f"Removed {before - len(df)} outlier rows using Isolation Forest"
                                    continue # Skip clipping logic
                                else:
                                    # Clip to min/max of the inliers
                                    inliers = df.loc[mask, col]
                                    lower, upper = inliers.min(), inliers.max()
                            except ImportError:
                                lower, upper = df[col].min(), df[col].max()
                                result["detail"] = "Isolation Forest requires scikit-learn. Falling back."
                        else:
                            lower, upper = df[col].min(), df[col].max()

                        if action == "clip":
                            df[col] = df[col].clip(lower=lower, upper=upper)
                            result["detail"] = f"Clipped outliers in {col} to [{lower:.2f}, {upper:.2f}]"
                        elif action == "remove":
                            before = len(df)
                            df = df[(df[col] >= lower) & (df[col] <= upper)]
                            result["detail"] = f"Removed {before - len(df)} outlier rows from {col}"

                elif op_type == "encode_label":
                    if col and col in df.columns:
                        df[col] = df[col].astype("category").cat.codes
                        result["detail"] = f"Label-encoded {col}"

                elif op_type == "encode_onehot":
                    if col and col in df.columns:
                        df = pd.get_dummies(df, columns=[col])
                        result["detail"] = f"One-hot encoded {col}"

                elif op_type == "scale_standard":
                    if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        from sklearn.preprocessing import StandardScaler
                        scaler = StandardScaler()
                        df[col] = scaler.fit_transform(df[[col]])
                        result["detail"] = f"Standard scaled {col}"

                elif op_type == "scale_minmax":
                    if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        from sklearn.preprocessing import MinMaxScaler
                        scaler = MinMaxScaler()
                        df[col] = scaler.fit_transform(df[[col]])
                        result["detail"] = f"Min-Max scaled {col}"

                elif op_type == "normalize":
                    if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        col_min = df[col].min()
                        col_max = df[col].max()
                        if col_max != col_min:
                            df[col] = (df[col] - col_min) / (col_max - col_min)
                        result["detail"] = f"Normalized {col} to [0, 1]"

                elif op_type == "pca":
                    n_components = op.get("n_components", 2)
                    numeric_cols = df.select_dtypes(include=["number"]).columns
                    if len(numeric_cols) > n_components:
                        try:
                            from sklearn.decomposition import PCA
                            from sklearn.preprocessing import StandardScaler
                            
                            # PCA requires no missing values
                            temp_df = df[numeric_cols].fillna(df[numeric_cols].median())
                            scaled_data = StandardScaler().fit_transform(temp_df)
                            
                            pca = PCA(n_components=n_components)
                            pca_features = pca.fit_transform(scaled_data)
                            
                            for i in range(n_components):
                                df[f"pca_component_{i+1}"] = pca_features[:, i]
                                
                            result["detail"] = f"Added {n_components} PCA components"
                        except ImportError:
                            result["status"] = "failed"
                            result["detail"] = "PCA requires scikit-learn"
                    else:
                        result["status"] = "skipped"
                        result["detail"] = "Not enough numeric columns for PCA"

                elif op_type == "correct_dtype":
                    target_dtype = op.get("target_dtype", "float")
                    if col and col in df.columns:
                        try:
                            df[col] = df[col].astype(target_dtype)
                            result["detail"] = f"Converted {col} to {target_dtype}"
                        except ValueError as e:
                            result["status"] = "failed"
                            result["detail"] = str(e)

            except Exception as e:
                result["status"] = "failed"
                result["detail"] = str(e)

            report["operations_applied"].append(result)

        # Save cleaned file
        base, _ = os.path.splitext(file_path)
        output_path = f"{base}_cleaned.csv"
        df.to_csv(output_path, index=False)

        report.update({
            "rows_after": len(df),
            "columns_after": len(df.columns),
            "output_path": output_path,
        })

        return {"success": True, "output_path": output_path, "rows": len(df), "columns": len(df.columns), "report": report}

    # ─── TEXT CLEANING ─────────────────────────────────────────────

    @staticmethod
    def clean_text(file_path: str, ext: str, operations: list[dict]) -> dict:
        """Apply text-specific cleaning operations."""
        df = CleaningService._load_df(file_path, ext)
        if df is None:
            return {"success": False, "error": "Could not load dataset"}

        report = {"operations_applied": [], "rows_before": len(df), "columns_before": len(df.columns)}

        for op in operations:
            op_type = op.get("type")
            col = op.get("column")
            result = {"type": op_type, "column": col, "status": "success"}

            try:
                if op_type == "drop_duplicates":
                    before = len(df)
                    df = df.drop_duplicates()
                    result["detail"] = f"Removed {before - len(df)} duplicates"

                elif op_type == "drop_missing":
                    before = len(df)
                    if col:
                        df = df.dropna(subset=[col])
                    else:
                        df = df.dropna()
                    result["detail"] = f"Dropped {before - len(df)} rows with missing values"

                elif op_type == "fill_missing":
                    strategy = op.get("strategy", "empty_string")
                    if col and col in df.columns:
                        if strategy == "empty_string":
                            df[col] = df[col].fillna("")
                        elif strategy == "mode":
                            df[col] = df[col].fillna(df[col].mode().iloc[0] if len(df[col].mode()) > 0 else "")

                elif op_type == "normalize_text":
                    if col and col in df.columns:
                        df[col] = df[col].astype(str).str.strip()
                        df[col] = df[col].str.lower()
                        result["detail"] = f"Normalized text in {col} (lowercase, strip)"

                elif op_type == "remove_stopwords":
                    if col and col in df.columns:
                        # Simple English stopwords
                        stopwords = {
                            "a", "an", "the", "is", "are", "was", "were", "be", "been",
                            "being", "have", "has", "had", "do", "does", "did", "will",
                            "would", "could", "should", "may", "might", "can", "shall",
                            "of", "in", "to", "for", "with", "on", "at", "by", "from",
                            "as", "into", "through", "during", "before", "after", "above",
                            "below", "between", "out", "off", "over", "under", "again",
                            "further", "then", "once", "and", "but", "or", "nor", "not",
                            "so", "yet", "both", "each", "few", "more", "most", "other",
                            "some", "such", "no", "only", "own", "same", "than", "too",
                            "very", "just", "because", "about", "up", "it", "its", "this",
                            "that", "these", "those", "i", "me", "my", "we", "our", "you",
                            "your", "he", "him", "his", "she", "her", "they", "them", "their",
                        }
                        df[col] = df[col].astype(str).apply(
                            lambda x: " ".join(w for w in x.split() if w.lower() not in stopwords)
                        )
                        result["detail"] = f"Removed stopwords from {col}"

                elif op_type == "remove_punctuation":
                    import re
                    if col and col in df.columns:
                        df[col] = df[col].astype(str).apply(lambda x: re.sub(r'[^\w\s]', '', x))
                        result["detail"] = f"Removed punctuation from {col}"

                elif op_type == "fix_encoding":
                    if col and col in df.columns:
                        df[col] = df[col].astype(str).apply(
                            lambda x: x.encode("ascii", errors="ignore").decode("ascii")
                        )
                        result["detail"] = f"Fixed encoding in {col}"

                elif op_type == "check_label_consistency":
                    if col and col in df.columns:
                        # Normalize labels: strip, lowercase
                        df[col] = df[col].astype(str).str.strip().str.lower()
                        result["detail"] = f"Normalized labels in {col}"

            except Exception as e:
                result["status"] = "failed"
                result["detail"] = str(e)

            report["operations_applied"].append(result)

        # Save
        base, _ = os.path.splitext(file_path)
        output_path = f"{base}_cleaned.csv"
        df.to_csv(output_path, index=False)

        report.update({
            "rows_after": len(df),
            "columns_after": len(df.columns),
            "output_path": output_path,
        })

        return {"success": True, "output_path": output_path, "rows": len(df), "columns": len(df.columns), "report": report}

    # ─── IMAGE CLEANING ───────────────────────────────────────────

    @staticmethod
    def clean_images(image_dir: str, operations: list[dict]) -> dict:
        """
        Apply image cleaning operations to a dataset directory.

        Supported ops:
        - remove_corrupt: Auto-remove broken images
        - remove_duplicates: Remove detected duplicates
        - filter_quality: Remove blurry/overexposed/underexposed/low_res images
        - resize_all: Resize to target dimensions
        - convert_format: Convert to target format
        """
        from services.image_service import ImageService

        report = {"operations_applied": []}

        for op in operations:
            op_type = op.get("type")
            result = {"type": op_type, "status": "success"}

            try:
                if op_type == "remove_corrupt":
                    # Get all image paths
                    paths = CleaningService._get_image_paths(image_dir)
                    corrupt = ImageService.detect_corrupt_images(paths)
                    removed = ImageService.remove_files(corrupt)
                    result["detail"] = f"Removed {removed['removed']} corrupt images"

                elif op_type == "remove_duplicates":
                    threshold = op.get("threshold", 5)
                    paths = CleaningService._get_image_paths(image_dir)
                    groups = ImageService.detect_duplicates(paths, threshold=threshold)
                    # Keep first of each group, remove rest
                    to_remove = []
                    for group in groups:
                        to_remove.extend(group[1:])
                    removed = ImageService.remove_files(to_remove)
                    result["detail"] = f"Removed {removed['removed']} duplicate images from {len(groups)} groups"

                elif op_type == "filter_quality":
                    min_blur = op.get("min_blur_score", 100)
                    paths = CleaningService._get_image_paths(image_dir)
                    quality = ImageService.assess_quality(paths)
                    to_remove = set()
                    if op.get("remove_blurry", True):
                        to_remove.update(quality["blurry"])
                    if op.get("remove_overexposed", True):
                        to_remove.update(quality["overexposed"])
                    if op.get("remove_underexposed", True):
                        to_remove.update(quality["underexposed"])
                    if op.get("remove_low_resolution", True):
                        to_remove.update(quality["low_resolution"])
                    if op.get("remove_noisy", False):
                        to_remove.update(quality["noisy"])
                    removed = ImageService.remove_files(list(to_remove))
                    result["detail"] = f"Removed {removed['removed']} low-quality images"

                elif op_type == "resize_all":
                    width = op.get("width", 224)
                    height = op.get("height", 224)
                    output_dir = op.get("output_dir", image_dir + "_resized")
                    maintain_aspect = op.get("maintain_aspect", False)
                    resize_result = ImageService.resize_images(
                        image_dir, output_dir,
                        target_size=(width, height),
                        maintain_aspect=maintain_aspect,
                    )
                    result["detail"] = f"Resized {resize_result['processed']} images to {width}x{height}"
                    result["output_dir"] = resize_result["output_dir"]

                elif op_type == "convert_format":
                    target_format = op.get("target_format", "png")
                    output_dir = op.get("output_dir", image_dir + f"_{target_format}")
                    convert_result = ImageService.convert_format(
                        image_dir, output_dir, target_format=target_format,
                    )
                    result["detail"] = f"Converted {convert_result['processed']} images to {target_format}"
                    result["output_dir"] = convert_result["output_dir"]

            except Exception as e:
                result["status"] = "failed"
                result["detail"] = str(e)

            report["operations_applied"].append(result)

        # Count remaining images
        remaining = len(CleaningService._get_image_paths(image_dir))
        report["remaining_images"] = remaining

        return {"success": True, "report": report, "remaining_images": remaining}

    # ─── UTILITIES ─────────────────────────────────────────────────

    @staticmethod
    def _load_df(file_path: str, ext: str) -> Optional[pd.DataFrame]:
        """Load dataframe from file."""
        try:
            if ext in (".csv", "csv"):
                return pd.read_csv(file_path)
            elif ext in (".xlsx", ".xls", "xlsx", "xls"):
                return pd.read_excel(file_path)
            elif ext in (".json", "json"):
                return pd.read_json(file_path)
            elif ext in (".txt", "txt"):
                try:
                    return pd.read_csv(file_path, sep="\t")
                except Exception:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                    return pd.DataFrame({"text": [l.strip() for l in lines if l.strip()]})
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return None
        return None

    @staticmethod
    def _get_image_paths(image_dir: str) -> list[str]:
        """Get all image paths in a directory tree."""
        from services.dataset_service import IMAGE_EXTENSIONS
        paths = []
        for root, dirs, files in os.walk(image_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]
            for f in files:
                if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS and not f.startswith("."):
                    paths.append(os.path.join(root, f))
        return paths
