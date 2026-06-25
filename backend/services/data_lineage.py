"""
NeuralForge — Data Lineage & Knowledge Tracing Service
Finds similar training examples, cluster information, and data lineage
to explain which training data most influenced a prediction.
"""

import os
import logging
from typing import Dict, Any, List, Optional

import pandas as pd
import numpy as np

logger = logging.getLogger("neuralforge.data_lineage")


class DataLineageService:
    """Dataset-to-Knowledge Tracing for trained models."""

    @staticmethod
    def find_similar_training_examples(
        X_single: np.ndarray,
        X_train: pd.DataFrame,
        y_train: np.ndarray = None,
        k: int = 5,
        feature_names: List[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Find the k nearest neighbors from the training data to a prediction input.
        Uses Euclidean distance on standardized features.
        
        Returns a list of dicts with training example data and distance.
        """
        try:
            from sklearn.neighbors import NearestNeighbors
            from sklearn.preprocessing import StandardScaler

            # Ensure X_single is 2D
            if X_single.ndim == 1:
                X_single = X_single.reshape(1, -1)

            # Subsample if training data is too large
            max_samples = 5000
            if len(X_train) > max_samples:
                sample_idx = np.random.choice(len(X_train), max_samples, replace=False)
                X_sample = X_train.iloc[sample_idx].values if isinstance(X_train, pd.DataFrame) else X_train[sample_idx]
                y_sample = y_train[sample_idx] if y_train is not None else None
            else:
                X_sample = X_train.values if isinstance(X_train, pd.DataFrame) else X_train
                y_sample = y_train

            # Standardize
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X_sample)
            X_single_scaled = scaler.transform(X_single)

            # Find k nearest neighbors
            nn = NearestNeighbors(n_neighbors=min(k, len(X_scaled)), metric='euclidean')
            nn.fit(X_scaled)
            distances, indices = nn.kneighbors(X_single_scaled)

            results = []
            names = feature_names or [f"feature_{i}" for i in range(X_sample.shape[1])]

            for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
                example = {}
                row = X_sample[idx]
                for j, name in enumerate(names):
                    if j < len(row):
                        val = row[j]
                        example[name] = float(val) if isinstance(val, (np.floating, float)) else val

                entry = {
                    "rank": i + 1,
                    "distance": round(float(dist), 4),
                    "similarity": round(float(1 / (1 + dist)), 4),  # Convert distance to similarity
                    "features": example,
                }

                if y_sample is not None:
                    entry["target"] = str(y_sample[idx]) if hasattr(y_sample, '__getitem__') else str(y_sample)

                results.append(entry)

            return results

        except Exception as e:
            logger.error(f"Similar example search failed: {e}")
            return []

    @staticmethod
    def find_cluster_info(
        X_train: pd.DataFrame,
        X_single: np.ndarray,
        n_clusters: int = 5,
        feature_names: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Determine which cluster the input belongs to using k-means.
        Returns cluster ID, size, and centroid information.
        """
        try:
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler

            if X_single.ndim == 1:
                X_single = X_single.reshape(1, -1)

            # Subsample training data
            max_samples = 3000
            if len(X_train) > max_samples:
                X_sample = X_train.sample(max_samples, random_state=42).values if isinstance(X_train, pd.DataFrame) else X_train[:max_samples]
            else:
                X_sample = X_train.values if isinstance(X_train, pd.DataFrame) else X_train

            # Standardize
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X_sample)
            X_single_scaled = scaler.transform(X_single)

            # Fit k-means
            n_clusters = min(n_clusters, len(X_scaled))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X_scaled)

            # Predict cluster for input
            cluster_id = int(kmeans.predict(X_single_scaled)[0])

            # Count samples per cluster
            cluster_sizes = {int(i): int(count) for i, count in zip(*np.unique(labels, return_counts=True))}

            # Get centroid features
            names = feature_names or [f"feature_{i}" for i in range(X_sample.shape[1])]
            centroid = kmeans.cluster_centers_[cluster_id]
            centroid_original = scaler.inverse_transform(centroid.reshape(1, -1))[0]
            centroid_dict = {names[i]: round(float(centroid_original[i]), 4) for i in range(min(len(names), len(centroid_original)))}

            return {
                "cluster_id": cluster_id,
                "cluster_size": cluster_sizes.get(cluster_id, 0),
                "total_clusters": n_clusters,
                "cluster_sizes": cluster_sizes,
                "centroid": centroid_dict,
                "percentage_of_data": round(cluster_sizes.get(cluster_id, 0) / len(X_scaled) * 100, 1),
            }

        except Exception as e:
            logger.error(f"Cluster analysis failed: {e}")
            return {"error": str(e)}

    @staticmethod
    def get_data_lineage(
        model_name: str,
        dataset_info: Dict,
        cleaning_report: Dict = None,
        training_params: Dict = None,
    ) -> Dict[str, Any]:
        """
        Build a complete data lineage trace from raw data to prediction.
        """
        lineage = {
            "stages": [
                {
                    "stage": "Raw Data Upload",
                    "description": f"Dataset: {dataset_info.get('filename', 'Unknown')}",
                    "details": {
                        "rows": dataset_info.get("rows"),
                        "columns": dataset_info.get("columns"),
                        "target": dataset_info.get("target"),
                    },
                },
            ],
        }

        # Cleaning stage
        if cleaning_report:
            lineage["stages"].append({
                "stage": "Data Cleaning",
                "description": "Automated data quality improvements",
                "details": {
                    "missing_values_handled": cleaning_report.get("missing_values_removed", 0),
                    "duplicates_removed": cleaning_report.get("duplicates_removed", 0),
                    "outliers_handled": cleaning_report.get("outliers_handled", 0),
                    "rows_after": cleaning_report.get("rows_after"),
                    "columns_after": cleaning_report.get("columns_after"),
                },
            })

        # Feature Engineering
        lineage["stages"].append({
            "stage": "Feature Engineering",
            "description": "Automated feature preprocessing",
            "details": {
                "categorical_encoding": "Label Encoding",
                "numerical_scaling": "Standard Scaler",
                "missing_value_strategy": "Median (numeric) / Mode (categorical)",
            },
        })

        # Model Training
        lineage["stages"].append({
            "stage": "Model Training",
            "description": f"Trained {model_name}",
            "details": training_params or {},
        })

        # Prediction
        lineage["stages"].append({
            "stage": "Prediction",
            "description": "Real-time inference on new data",
            "details": {
                "preprocessing": "Same pipeline as training",
                "model": model_name,
            },
        })

        return lineage
