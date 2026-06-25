"""
NeuralForge — Playground Service
Handles live model inference, prediction with explanations, and model feature schema.
Uses LRU caching for loaded models to avoid repeated disk reads.
"""

import os
import logging
import functools
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd
import numpy as np
import joblib

logger = logging.getLogger("neuralforge.playground")


class PlaygroundService:
    """Manages model loading, inference, and explanation orchestration."""

    # Class-level model cache (LRU, max 5 models in memory)
    _model_cache: Dict[str, Any] = {}
    _preprocessor_cache: Dict[str, Any] = {}
    MAX_CACHE = 5

    @classmethod
    def load_model(cls, model_path: str, model_format: str) -> Any:
        """Load a trained model from disk with caching."""
        cache_key = model_path
        if cache_key in cls._model_cache:
            return cls._model_cache[cache_key]

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        model = None
        try:
            if model_format == "joblib":
                model = joblib.load(model_path)
            elif model_format == "pkl":
                import pickle
                with open(model_path, 'rb') as f:
                    model = pickle.load(f)
            elif model_format in ("json", "bst"):
                import xgboost as xgb
                model = xgb.XGBClassifier()
                model.load_model(model_path)
            elif model_format == "txt":
                import lightgbm as lgb
                model = lgb.Booster(model_file=model_path)
            elif model_format in ("h5", "keras"):
                from tensorflow import keras
                model = keras.models.load_model(model_path)
            elif model_format in ("pt", "pth"):
                import torch
                model = torch.load(model_path, weights_only=False)
            elif model_format == "onnx":
                import onnxruntime as rt
                model = rt.InferenceSession(model_path)
            else:
                # Fallback: try joblib
                model = joblib.load(model_path)
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            raise

        # Manage cache size
        if len(cls._model_cache) >= cls.MAX_CACHE:
            oldest_key = next(iter(cls._model_cache))
            del cls._model_cache[oldest_key]

        cls._model_cache[cache_key] = model
        return model

    @classmethod
    def load_preprocessors(cls, preprocessing_path: str) -> Optional[Dict]:
        """Load saved preprocessing pipeline."""
        if not preprocessing_path or not os.path.exists(preprocessing_path):
            return None

        if preprocessing_path in cls._preprocessor_cache:
            return cls._preprocessor_cache[preprocessing_path]

        try:
            preprocessors = joblib.load(preprocessing_path)
            cls._preprocessor_cache[preprocessing_path] = preprocessors
            return preprocessors
        except Exception as e:
            logger.warning(f"Could not load preprocessors: {e}")
            return None

    @staticmethod
    def preprocess_input(
        input_data: List[Dict[str, Any]],
        feature_names: List[str] = None,
        feature_types: Dict[str, str] = None,
        preprocessors: Dict = None,
    ) -> pd.DataFrame:
        """
        Preprocess raw input data for model prediction.
        Handles encoding, missing values, and scaling.
        """
        df = pd.DataFrame(input_data)

        # Ensure column order matches training
        if feature_names:
            # Add missing columns with defaults
            for col in feature_names:
                if col not in df.columns:
                    dtype = (feature_types or {}).get(col, "numeric")
                    df[col] = 0 if dtype == "numeric" else "Unknown"
            # Reorder to match training
            available_cols = [c for c in feature_names if c in df.columns]
            df = df[available_cols]

        # Handle categorical encoding
        if preprocessors:
            label_encoders = preprocessors.get("label_encoders", {})
            for col, classes in label_encoders.items():
                if col in df.columns and col != "__target__":
                    from sklearn.preprocessing import LabelEncoder
                    le = LabelEncoder()
                    le.classes_ = np.array(classes)
                    # Map unseen categories to first class
                    mask = df[col].astype(str).isin(classes)
                    df.loc[~mask, col] = classes[0]
                    df[col] = le.transform(df[col].astype(str))

            scaler = preprocessors.get("scaler")
            if scaler is not None:
                numeric_cols = df.select_dtypes(include=["number"]).columns
                if len(numeric_cols) > 0:
                    df[numeric_cols] = scaler.transform(df[numeric_cols])
        else:
            # Basic encoding for categorical columns without saved preprocessors
            for col in df.select_dtypes(include=["object", "category"]).columns:
                from sklearn.preprocessing import LabelEncoder
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))

        # Fill remaining NaN
        df = df.fillna(0)

        return df

    @staticmethod
    def predict(model: Any, df: pd.DataFrame, model_format: str = "joblib") -> Dict[str, Any]:
        """
        Run prediction on preprocessed data.
        Returns predictions, probabilities, and confidence scores.
        """
        result = {"predictions": [], "probabilities": None, "confidence": None, "classes": None}

        try:
            if model_format == "onnx":
                # ONNX runtime inference
                input_name = model.get_inputs()[0].name
                pred = model.run(None, {input_name: df.values.astype(np.float32)})[0]
                result["predictions"] = pred.tolist()
            else:
                # Standard sklearn-compatible predict
                predictions = model.predict(df)
                result["predictions"] = predictions.tolist()

                if hasattr(model, "predict_proba"):
                    proba = model.predict_proba(df)
                    result["probabilities"] = proba.tolist()
                    result["confidence"] = [float(max(p)) for p in proba]

                    if hasattr(model, "classes_"):
                        result["classes"] = [str(c) for c in model.classes_]

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise

        return result

    @staticmethod
    def get_feature_schema(
        feature_names: List[str],
        feature_types: Dict[str, str] = None,
        training_data_path: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Build a feature schema for the playground input form.
        Returns a list of feature descriptors with name, type, range, etc.
        """
        schema = []
        stats = {}

        # Try to load training data for statistics
        if training_data_path and os.path.exists(training_data_path):
            try:
                train_df = pd.read_csv(training_data_path, nrows=1000)
                for col in train_df.columns:
                    if col in feature_names:
                        if train_df[col].dtype in ('float64', 'float32', 'int64', 'int32'):
                            stats[col] = {
                                "min": float(train_df[col].min()),
                                "max": float(train_df[col].max()),
                                "mean": float(train_df[col].mean()),
                                "median": float(train_df[col].median()),
                            }
                        else:
                            stats[col] = {
                                "unique_values": train_df[col].dropna().unique().tolist()[:50],
                            }
            except Exception as e:
                logger.warning(f"Could not load training data for schema: {e}")

        for name in feature_names:
            ftype = (feature_types or {}).get(name, "numeric")
            feature_info = {
                "name": name,
                "type": ftype,
                "input_type": "number" if ftype == "numeric" else "select",
            }

            if name in stats:
                feature_info["stats"] = stats[name]
                if ftype == "numeric":
                    feature_info["default_value"] = stats[name].get("median", 0)
                    feature_info["min"] = stats[name].get("min", 0)
                    feature_info["max"] = stats[name].get("max", 100)
                elif "unique_values" in stats[name]:
                    feature_info["options"] = stats[name]["unique_values"]
                    feature_info["default_value"] = stats[name]["unique_values"][0] if stats[name]["unique_values"] else ""
            else:
                feature_info["default_value"] = 0 if ftype == "numeric" else ""

            schema.append(feature_info)

        return schema
