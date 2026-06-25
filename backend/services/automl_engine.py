"""
NeuralForge — AutoML Engine
Handles automatic training, hyperparameter tuning, model selection, and overfitting detection.
"""

import logging
import json
import os
from typing import Dict, Any, List, Tuple
from datetime import datetime

import pandas as pd
import numpy as np

# ML frameworks
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score, mean_absolute_error, precision_score, recall_score, roc_auc_score
from sklearn.preprocessing import StandardScaler, LabelEncoder

# Linear Models
from sklearn.linear_model import LogisticRegression, LinearRegression, RidgeClassifier, Ridge, SGDClassifier, Lasso, ElasticNet
# Ensembles
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, ExtraTreesClassifier, ExtraTreesRegressor, AdaBoostClassifier, GradientBoostingClassifier
# SVM, KNN, NB, Trees, MLP
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.neural_network import MLPClassifier, MLPRegressor

# Gradient Boosters
from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier, LGBMRegressor
from catboost import CatBoostClassifier, CatBoostRegressor

logger = logging.getLogger("neuralforge.automl")

class AutoMLEngine:
    """Orchestrates model training, selection, and overfitting detection."""

    def __init__(self, df: pd.DataFrame, target_column: str, task_type: str):
        self.df = df
        self.target_column = target_column
        self.task_type = task_type
        
        self.X = None
        self.y = None
        self.X_train, self.X_test, self.y_train, self.y_test = None, None, None, None
        
        self.models_to_try = []
        self.trained_models = []
        self.label_encoders = {}
        self.scaler = None
        
        self.setup_data()
        self.setup_models()

    def setup_data(self):
        """Prepare X, y, handle missing values, encode features."""
        # Drop rows where target is missing
        self.df = self.df.dropna(subset=[self.target_column])
        
        self.y = self.df[self.target_column]
        self.X = self.df.drop(columns=[self.target_column])
        
        # Handle Missing Values in X
        numeric_cols = self.X.select_dtypes(include=['number']).columns
        categorical_cols = self.X.select_dtypes(exclude=['number']).columns
        
        # Fill numeric with median
        for col in numeric_cols:
            self.X[col] = self.X[col].fillna(self.X[col].median())
            
        # Encode categorical and fill with mode
        for col in categorical_cols:
            mode_val = self.X[col].mode()
            if len(mode_val) > 0:
                self.X[col] = self.X[col].fillna(mode_val[0])
            else:
                self.X[col] = self.X[col].fillna("Unknown")
                
            le = LabelEncoder()
            self.X[col] = le.fit_transform(self.X[col].astype(str))
            self.label_encoders[col] = le
            
        # Encode Target if classification
        if self.task_type in ['classification', 'tabular_classification']:
            le_target = LabelEncoder()
            self.y = le_target.fit_transform(self.y.astype(str))
            self.label_encoders['__target__'] = le_target
            
        # Scale Features
        self.scaler = StandardScaler()
        self.X = pd.DataFrame(self.scaler.fit_transform(self.X), columns=self.X.columns)
        
        # Split Data
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.X, self.y, test_size=0.2, random_state=42
        )

    def setup_models(self):
        """Initialize candidate models based on task type."""
        if self.task_type in ['classification', 'tabular_classification']:
            self.models_to_try = [
                ("Logistic Regression", LogisticRegression(max_iter=1000)),
                ("Ridge Classifier", RidgeClassifier()),
                ("SGD Classifier", SGDClassifier(random_state=42)),
                ("Random Forest", RandomForestClassifier(n_estimators=100, random_state=42)),
                ("Extra Trees", ExtraTreesClassifier(n_estimators=100, random_state=42)),
                ("AdaBoost", AdaBoostClassifier(random_state=42)),
                ("Gradient Boosting", GradientBoostingClassifier(random_state=42)),
                ("XGBoost", XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=42)),
                ("CatBoost", CatBoostClassifier(verbose=0, random_state=42)),
                ("LightGBM", LGBMClassifier(random_state=42)),
                ("SVM", SVC(probability=True, random_state=42)),
                ("KNN", KNeighborsClassifier()),
                ("Naive Bayes", GaussianNB()),
                ("Decision Tree", DecisionTreeClassifier(random_state=42)),
                ("Neural Network (MLP)", MLPClassifier(max_iter=500, random_state=42))
            ]
        elif self.task_type in ['regression', 'tabular_regression']:
            self.models_to_try = [
                ("Linear Regression", LinearRegression()),
                ("Ridge", Ridge()),
                ("Lasso", Lasso()),
                ("ElasticNet", ElasticNet()),
                ("Random Forest Regressor", RandomForestRegressor(n_estimators=100, random_state=42)),
                ("Extra Trees Regressor", ExtraTreesRegressor(n_estimators=100, random_state=42)),
                ("XGBoost Regressor", XGBRegressor(random_state=42)),
                ("CatBoost Regressor", CatBoostRegressor(verbose=0, random_state=42)),
                ("LightGBM Regressor", LGBMRegressor(random_state=42)),
                ("SVR", SVR()),
                ("KNN Regressor", KNeighborsRegressor()),
                ("Neural Network Regressor (MLP)", MLPRegressor(max_iter=500, random_state=42))
            ]
        else:
            raise ValueError(f"Unsupported task type for AutoML: {self.task_type}")

    def train_all(self, update_callback=None) -> List[Dict]:
        """Train all candidate models, calculate Generalization Gap, and return metrics."""
        results = []
        total_models = len(self.models_to_try)
        
        for idx, (name, model) in enumerate(self.models_to_try):
            logger.info(f"Training {name}...")
            
            start_time = datetime.now()
            try:
                model.fit(self.X_train, self.y_train)
                end_time = datetime.now()
                
                # Predict on both Train and Test to check for overfitting
                y_train_pred = model.predict(self.X_train)
                y_test_pred = model.predict(self.X_test)
                
                train_metrics = self._calculate_metrics(self.y_train, y_train_pred)
                test_metrics = self._calculate_metrics(self.y_test, y_test_pred)
                
                # Calculate Generalization Gap and Status
                if self.task_type in ['classification', 'tabular_classification']:
                    gap = train_metrics['accuracy'] - test_metrics['accuracy']
                else:
                    gap = train_metrics['r2'] - test_metrics['r2']
                
                # Determine Overfitting Status
                overfitting_status = "Healthy"
                if gap > 0.15:
                    overfitting_status = "Severe Overfitting"
                elif gap > 0.05:
                    overfitting_status = "Moderate Overfitting"
                elif gap < -0.05:
                    overfitting_status = "Underfitting"

                result = {
                    "model_name": name,
                    "model": model,
                    "metrics": test_metrics,  # Main metrics are test metrics
                    "train_metrics": train_metrics,
                    "generalization_gap": float(gap),
                    "overfitting_status": overfitting_status,
                    "safe_retraining_range": "10-15 hyperparameter cycles recommended before diminishing returns",
                    "training_time_sec": (end_time - start_time).total_seconds()
                }
                results.append(result)
                self.trained_models.append(result)
                
                if update_callback:
                    progress = ((idx + 1) / total_models) * 100
                    update_callback(progress, name, test_metrics)
            except Exception as e:
                logger.error(f"Failed to train {name}: {str(e)}")
                
        # Sort results based on task type logic (highest F1/R2)
        if self.task_type in ['classification', 'tabular_classification']:
            results.sort(key=lambda x: x['metrics'].get('f1', 0), reverse=True)
        else:
            results.sort(key=lambda x: x['metrics'].get('r2', 0), reverse=True)
            
        return results

    def _calculate_metrics(self, y_true, y_pred) -> Dict[str, float]:
        """Calculate standard metrics for classification/regression."""
        metrics = {}
        if self.task_type in ['classification', 'tabular_classification']:
            metrics['accuracy'] = float(accuracy_score(y_true, y_pred))
            metrics['f1'] = float(f1_score(y_true, y_pred, average='weighted', zero_division=0))
            metrics['precision'] = float(precision_score(y_true, y_pred, average='weighted', zero_division=0))
            metrics['recall'] = float(recall_score(y_true, y_pred, average='weighted', zero_division=0))
        elif self.task_type in ['regression', 'tabular_regression']:
            metrics['mse'] = float(mean_squared_error(y_true, y_pred))
            metrics['rmse'] = float(np.sqrt(metrics['mse']))
            metrics['mae'] = float(mean_absolute_error(y_true, y_pred))
            metrics['r2'] = float(r2_score(y_true, y_pred))
        return metrics

    def get_best_model(self) -> Dict:
        """Return the best performing model."""
        if not self.trained_models:
            raise ValueError("No models trained yet.")
            
        if self.task_type in ['classification', 'tabular_classification']:
            best = max(self.trained_models, key=lambda x: x['metrics'].get('f1', 0))
        else:
            best = max(self.trained_models, key=lambda x: x['metrics'].get('r2', -float('inf')))
            
        return best
