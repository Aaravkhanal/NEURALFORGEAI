"""
NeuralForge — Model Artifact Service
Handles saving, multi-format export (pkl/joblib/onnx/h5/pt/xgboost/lightgbm),
format detection, and Model Card generation.
"""

import os
import json
import joblib
import logging
import pickle
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger("neuralforge.model_artifact")

class ModelArtifactService:
    
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    def save_model(self, model: Any, model_name: str, version: int, project_id: str) -> Dict[str, str]:
        """
        Saves the model in multiple formats if possible.
        Returns a dict of exported file paths.
        """
        export_paths = {}
        
        # Base directory for this model version
        model_dir = os.path.join(self.storage_dir, project_id, f"{model_name}_v{version}")
        os.makedirs(model_dir, exist_ok=True)
        
        base_path = os.path.join(model_dir, "model")

        # 1. Save as Joblib (preferred for scikit-learn/xgboost/lightgbm)
        try:
            joblib_path = f"{base_path}.joblib"
            joblib.dump(model, joblib_path)
            export_paths["joblib"] = joblib_path
        except Exception as e:
            logger.warning(f"Could not save as joblib: {e}")

        # 2. Save as Pickle
        try:
            pkl_path = f"{base_path}.pkl"
            with open(pkl_path, 'wb') as f:
                pickle.dump(model, f)
            export_paths["pkl"] = pkl_path
        except Exception as e:
            logger.warning(f"Could not save as pickle: {e}")

        # 3. Save as XGBoost JSON (if XGBoost)
        try:
            import xgboost as xgb
            if isinstance(model, (xgb.XGBClassifier, xgb.XGBRegressor)):
                xgb_path = f"{base_path}.json"
                model.save_model(xgb_path)
                export_paths["json"] = xgb_path
        except Exception as e:
            pass

        # 4. Save as LightGBM TXT (if LightGBM)
        try:
            import lightgbm as lgb
            if isinstance(model, (lgb.LGBMClassifier, lgb.LGBMRegressor)):
                lgb_path = f"{base_path}.txt"
                model.booster_.save_model(lgb_path)
                export_paths["txt"] = lgb_path
        except Exception as e:
            pass

        # 5. Export to ONNX (using skl2onnx or onnxmltools)
        # Note: In production this requires specific converters per model type.
        try:
            from skl2onnx import to_onnx
            # Very basic assumption of input size. A robust implementation needs actual input shapes.
            # Using a generic float32 array as dummy input placeholder
            import numpy as np
            dummy_input = np.zeros((1, getattr(model, 'n_features_in_', 10))).astype(np.float32)
            onx = to_onnx(model, dummy_input)
            onnx_path = f"{base_path}.onnx"
            with open(onnx_path, "wb") as f:
                f.write(onx.SerializeToString())
            export_paths["onnx"] = onnx_path
        except Exception as e:
            logger.warning(f"Could not export to ONNX: {e}")

        return export_paths

    def export_to_format(
        self, model: Any, target_format: str, model_name: str, version: int,
        project_id: str, num_features: int = None
    ) -> Optional[str]:
        """
        Export a trained model to a specific format.
        Returns the file path if successful, None if the format is not supported.
        
        Supported formats: pkl, joblib, onnx, h5, pt, pth, json (xgboost), txt (lightgbm), bst (xgboost)
        """
        model_dir = os.path.join(self.storage_dir, project_id, f"{model_name}_v{version}")
        os.makedirs(model_dir, exist_ok=True)
        base_path = os.path.join(model_dir, "model")

        try:
            if target_format == "pkl":
                path = f"{base_path}.pkl"
                with open(path, 'wb') as f:
                    pickle.dump(model, f)
                return path

            elif target_format == "joblib":
                path = f"{base_path}.joblib"
                joblib.dump(model, path)
                return path

            elif target_format == "onnx":
                try:
                    from skl2onnx import to_onnx
                    import numpy as np
                    n_feat = num_features or getattr(model, 'n_features_in_', 10)
                    dummy_input = np.zeros((1, n_feat)).astype(np.float32)
                    onx = to_onnx(model, dummy_input)
                    path = f"{base_path}.onnx"
                    with open(path, "wb") as f:
                        f.write(onx.SerializeToString())
                    return path
                except ImportError:
                    logger.warning("skl2onnx not installed, cannot export to ONNX")
                    return None

            elif target_format in ("h5", "keras"):
                # TensorFlow/Keras model
                try:
                    import tensorflow as tf
                    if hasattr(model, 'save'):
                        path = f"{base_path}.h5"
                        model.save(path)
                        return path
                except ImportError:
                    logger.warning("TensorFlow not available for .h5 export")
                return None

            elif target_format in ("pt", "pth"):
                # PyTorch model
                try:
                    import torch
                    path = f"{base_path}.{target_format}"
                    if hasattr(model, 'state_dict'):
                        torch.save(model.state_dict(), path)
                    else:
                        torch.save(model, path)
                    return path
                except ImportError:
                    logger.warning("PyTorch not available for .pt export")
                return None

            elif target_format in ("json", "bst"):
                # XGBoost native format
                try:
                    import xgboost as xgb
                    if isinstance(model, (xgb.XGBClassifier, xgb.XGBRegressor)):
                        path = f"{base_path}.{target_format}"
                        model.save_model(path)
                        return path
                except ImportError:
                    pass
                return None

            elif target_format == "txt":
                # LightGBM native format
                try:
                    import lightgbm as lgb
                    if isinstance(model, (lgb.LGBMClassifier, lgb.LGBMRegressor)):
                        path = f"{base_path}.txt"
                        model.booster_.save_model(path)
                        return path
                except ImportError:
                    pass
                return None

            else:
                logger.warning(f"Unsupported export format: {target_format}")
                return None

        except Exception as e:
            logger.error(f"Failed to export model to {target_format}: {e}")
            return None

    def get_available_formats(self, model: Any) -> List[Dict[str, str]]:
        """
        Inspect a model object and return which export formats are available.
        Returns a list of dicts: [{"format": "pkl", "label": "Pickle (.pkl)", "description": "..."}]
        """
        formats = [
            {"format": "pkl", "label": "Pickle (.pkl)", "description": "Python standard serialization"},
            {"format": "joblib", "label": "Joblib (.joblib)", "description": "Optimized for NumPy arrays, best for sklearn"},
        ]

        # Check for ONNX support
        try:
            from skl2onnx import to_onnx
            if hasattr(model, 'predict'):
                formats.append({
                    "format": "onnx", "label": "ONNX (.onnx)",
                    "description": "Cross-platform, optimized inference runtime"
                })
        except ImportError:
            pass

        # Check for XGBoost
        try:
            import xgboost as xgb
            if isinstance(model, (xgb.XGBClassifier, xgb.XGBRegressor)):
                formats.append({
                    "format": "json", "label": "XGBoost JSON (.json)",
                    "description": "Native XGBoost format, portable across platforms"
                })
                formats.append({
                    "format": "bst", "label": "XGBoost Binary (.bst)",
                    "description": "Native XGBoost binary, fast loading"
                })
        except ImportError:
            pass

        # Check for LightGBM
        try:
            import lightgbm as lgb
            if isinstance(model, (lgb.LGBMClassifier, lgb.LGBMRegressor)):
                formats.append({
                    "format": "txt", "label": "LightGBM (.txt)",
                    "description": "Native LightGBM text format"
                })
        except ImportError:
            pass

        # Check for TensorFlow/Keras
        try:
            import tensorflow as tf
            if hasattr(model, 'save') and hasattr(model, 'layers'):
                formats.append({
                    "format": "h5", "label": "Keras H5 (.h5)",
                    "description": "TensorFlow/Keras SavedModel format"
                })
        except ImportError:
            pass

        # Check for PyTorch
        try:
            import torch
            if hasattr(model, 'state_dict'):
                formats.append({
                    "format": "pt", "label": "PyTorch (.pt)",
                    "description": "PyTorch state dict format"
                })
                formats.append({
                    "format": "pth", "label": "PyTorch (.pth)",
                    "description": "PyTorch full model checkpoint"
                })
        except ImportError:
            pass

        return formats

    def generate_model_card(self, model_info: Dict, dataset_info: Dict, metrics: Dict) -> str:
        """
        Generates a comprehensive Model Card in Markdown format.
        """
        markdown = f"""# Model Card: {model_info.get('model_name', 'Untitled Model')}

## Basic Information
* **Model Type**: {model_info.get('task_type', 'Unknown')}
* **Algorithm**: {model_info.get('algorithm', 'Unknown')}
* **Training Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
* **Version**: {model_info.get('version', '1')}

## Dataset Information
* **Dataset**: {dataset_info.get('filename', 'Unknown')}
* **Rows**: {dataset_info.get('rows', 'Unknown')}
* **Columns**: {dataset_info.get('columns', 'Unknown')}
* **Target Column**: {dataset_info.get('target', 'Unknown')}

## Performance Metrics
"""
        for metric, value in metrics.items():
            if value is not None:
                markdown += f"* **{metric.upper()}**: {value:.4f}\n"

        markdown += """
## Limitations & Biases
* This model was automatically generated by NeuralForge AutoML.
* Performance on out-of-distribution data is not guaranteed.
* Potential biases in the source dataset will be reflected in the model predictions.
"""
        return markdown

    def save_model_card(self, model_name: str, version: int, project_id: str, markdown_content: str) -> str:
        model_dir = os.path.join(self.storage_dir, project_id, f"{model_name}_v{version}")
        os.makedirs(model_dir, exist_ok=True)
        card_path = os.path.join(model_dir, "MODEL_CARD.md")
        with open(card_path, "w") as f:
            f.write(markdown_content)
        return card_path
