"""
NeuralForge — AI Model Advisor Service
Intelligent model recommendation engine based on dataset characteristics.
Provides ranked recommendations with explanations, speed/accuracy tradeoffs,
and hardware requirements.

MODEL_DB contains 60+ models across all problem types:
  - Tabular Classification & Regression
  - Time Series Forecasting
  - NLP / Text Classification
  - Computer Vision / Image Classification
  - Object Detection
  - Anomaly Detection
  - Clustering
"""

import logging
from typing import Optional

logger = logging.getLogger("neuralforge.advisor")


# ── Model Knowledge Base ──────────────────────────────────────
# Every model the platform can recommend. Task types determine eligibility.
# Scoring is computed dynamically from dataset characteristics, NOT hardcoded.

MODEL_DB = {
    # ══════════════════════════════════════════════════════════
    #  TABULAR — Classification & Regression
    # ══════════════════════════════════════════════════════════
    "logistic_regression": {
        "display_name": "Logistic Regression",
        "task_types": ["tabular_classification"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Baseline", "Interpretable Models", "Binary Classification"],
        "strengths": [
            "Highly interpretable — coefficients show feature impact",
            "Extremely fast training and inference",
            "Works well with linearly separable data",
            "Good baseline to beat",
        ],
        "weaknesses": ["Cannot capture non-linear patterns", "Struggles with complex interactions"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 1000000],
    },
    "decision_tree": {
        "display_name": "Decision Tree",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Interpretable Models", "Quick Prototyping", "Rule Extraction"],
        "strengths": [
            "Easily visualizable and interpretable",
            "No feature scaling required",
            "Handles mixed data types well",
        ],
        "weaknesses": ["Prone to overfitting", "Unstable — small data changes lead to different trees"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 100000],
    },
    "random_forest": {
        "display_name": "Random Forest",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Fast",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "CPU",
        "use_cases": ["Interpretable Models", "Baseline Comparisons", "Feature Selection"],
        "strengths": [
            "Robust to outliers and overfitting",
            "Built-in feature importance",
            "No feature scaling needed",
            "Parallelizable training",
        ],
        "weaknesses": ["Lower accuracy ceiling than gradient boosting", "Larger model size"],
        "min_dataset_size": 30,
        "ideal_dataset_range": [100, 1000000],
    },
    "extra_trees": {
        "display_name": "Extra Trees",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Very Fast",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "CPU",
        "use_cases": ["High-Dimensional Data", "Fast Ensembles", "Feature Selection"],
        "strengths": [
            "Faster than Random Forest (random splits)",
            "Better generalization on noisy data",
            "Less prone to overfitting than single trees",
        ],
        "weaknesses": ["Slightly less accurate than RF on structured data", "Large model size"],
        "min_dataset_size": 30,
        "ideal_dataset_range": [100, 1000000],
    },
    "adaboost": {
        "display_name": "AdaBoost",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Fast",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Weak Learner Boosting", "Binary Classification", "Anomaly Detection"],
        "strengths": [
            "Simple and effective boosting algorithm",
            "Works well with weak learners",
            "Less prone to overfitting than deep models",
        ],
        "weaknesses": ["Sensitive to noisy data and outliers", "Lower ceiling than gradient boosting"],
        "min_dataset_size": 30,
        "ideal_dataset_range": [100, 500000],
    },
    "gradient_boosting": {
        "display_name": "Gradient Boosting (Sklearn)",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Small Datasets", "Baseline Models", "Quick Experiments"],
        "strengths": [
            "Well-understood algorithm",
            "Good for smaller datasets",
            "Part of sklearn ecosystem",
        ],
        "weaknesses": ["Slower than XGBoost/LightGBM on large data", "Sequential training (no parallelism)"],
        "min_dataset_size": 30,
        "ideal_dataset_range": [100, 100000],
    },
    "xgboost": {
        "display_name": "XGBoost",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Very High",
        "training_speed": "Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Finance", "Healthcare", "Marketing Analytics", "Kaggle Competitions"],
        "strengths": [
            "State-of-the-art for structured/tabular data",
            "Built-in regularization (L1 + L2)",
            "Handles missing values natively",
            "Feature importance built-in",
            "GPU acceleration available",
        ],
        "weaknesses": ["Less effective on unstructured data (images, text)", "Requires hyperparameter tuning"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [200, 10000000],
    },
    "lightgbm": {
        "display_name": "LightGBM",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Very High",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Large-Scale Data", "Click-Through Prediction", "Recommendation Systems"],
        "strengths": [
            "Fastest gradient boosting framework",
            "Handles large datasets efficiently (leaf-wise growth)",
            "Native categorical feature support",
            "Low memory usage",
        ],
        "weaknesses": ["Can overfit on very small datasets (<200 rows)", "Leaf-wise growth can be unstable"],
        "min_dataset_size": 100,
        "ideal_dataset_range": [500, 50000000],
    },
    "catboost": {
        "display_name": "CatBoost",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Very High",
        "training_speed": "Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["E-Commerce", "Insurance", "Data with Many Categories"],
        "strengths": [
            "Handles categorical features natively (no encoding needed)",
            "Robust to overfitting (ordered boosting)",
            "Minimal hyperparameter tuning needed",
            "Built-in GPU training",
        ],
        "weaknesses": ["Slightly slower training than LightGBM", "Larger memory footprint"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [200, 5000000],
    },
    "svm": {
        "display_name": "SVM (Support Vector Machine)",
        "task_types": ["tabular_classification"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Small Datasets", "High-Dimensional Data", "Binary Classification"],
        "strengths": [
            "Excellent on small-to-medium datasets",
            "Effective in high-dimensional spaces",
            "Kernel trick for non-linear boundaries",
        ],
        "weaknesses": ["Slow on large datasets (O(n²) scaling)", "Requires feature scaling", "Not great for many classes"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 50000],
    },
    "knn": {
        "display_name": "K-Nearest Neighbors",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "CPU",
        "use_cases": ["Baseline", "Small Datasets", "Anomaly Detection"],
        "strengths": [
            "No training phase — instance-based learning",
            "Simple and intuitive",
            "Good for small datasets with clear clusters",
        ],
        "weaknesses": ["Slow inference on large datasets", "Sensitive to feature scaling", "Curse of dimensionality"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 50000],
    },
    "linear_regression": {
        "display_name": "Linear Regression",
        "task_types": ["tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Low",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Baseline", "Interpretability", "Simple Relationships"],
        "strengths": [
            "Most interpretable regression model",
            "Extremely fast",
            "Good baseline to compare against",
        ],
        "weaknesses": ["Cannot capture non-linear patterns", "Sensitive to multicollinearity"],
        "min_dataset_size": 10,
        "ideal_dataset_range": [30, 10000000],
    },
    "elastic_net": {
        "display_name": "Elastic Net",
        "task_types": ["tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Feature Selection", "Regularized Regression", "High-Dimensional Data"],
        "strengths": [
            "Combines L1 and L2 regularization",
            "Automatic feature selection",
            "Handles multicollinearity well",
        ],
        "weaknesses": ["Linear model — limited complexity", "Requires feature scaling"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 5000000],
    },
    "ridge": {
        "display_name": "Ridge Regression",
        "task_types": ["tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Multicollinear Data", "Regularized Regression"],
        "strengths": ["Handles multicollinearity well", "Stable predictions", "Fast training"],
        "weaknesses": ["Cannot perform feature selection (no sparsity)", "Linear model only"],
        "min_dataset_size": 10,
        "ideal_dataset_range": [30, 5000000],
    },
    "svr": {
        "display_name": "SVR (Support Vector Regression)",
        "task_types": ["tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Small Datasets", "Non-Linear Regression"],
        "strengths": ["Kernel trick for non-linear patterns", "Robust to outliers"],
        "weaknesses": ["Slow on large datasets", "Requires feature scaling"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 30000],
    },
    "tabnet": {
        "display_name": "TabNet",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "1-10M",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Medium",
        "hardware": "Low GPU",
        "use_cases": ["Deep Learning on Tabular Data", "Feature Selection", "Interpretable DL"],
        "strengths": [
            "Attention-based feature selection",
            "State-of-the-art on some tabular benchmarks",
            "Built-in interpretability (feature masks)",
        ],
        "weaknesses": ["Requires more data than tree models", "Needs GPU for reasonable speed", "Complex to tune"],
        "min_dataset_size": 1000,
        "ideal_dataset_range": [5000, 10000000],
    },
    "ft_transformer": {
        "display_name": "FT-Transformer",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "5-50M",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "Medium GPU",
        "use_cases": ["Complex Tabular Data", "Research", "Large Datasets"],
        "strengths": [
            "Transformer architecture adapted for tabular data",
            "Captures complex feature interactions",
            "Competitive with XGBoost on large datasets",
        ],
        "weaknesses": ["Requires large dataset (5k+)", "GPU required", "Long training time"],
        "min_dataset_size": 5000,
        "ideal_dataset_range": [10000, 50000000],
    },
    "autogluon": {
        "display_name": "AutoGluon",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "CPU",
        "use_cases": ["AutoML", "Competitions", "Production Baselines"],
        "strengths": [
            "AutoML — trains and ensembles multiple models automatically",
            "Often achieves top performance with zero configuration",
            "Handles preprocessing automatically",
        ],
        "weaknesses": ["Very slow training (trains many models)", "Large disk footprint", "Less control over pipeline"],
        "min_dataset_size": 100,
        "ideal_dataset_range": [500, 5000000],
    },
    "h2o_automl": {
        "display_name": "H2O AutoML",
        "task_types": ["tabular_classification", "tabular_regression"],
        "parameters": "N/A",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "CPU",
        "use_cases": ["Enterprise AutoML", "Distributed Training", "Production"],
        "strengths": [
            "Distributed training across multiple nodes",
            "Stacked ensemble of best models",
            "Enterprise-grade with MOJO export",
        ],
        "weaknesses": ["Requires JVM", "Heavy resource usage", "Complex deployment"],
        "min_dataset_size": 200,
        "ideal_dataset_range": [1000, 100000000],
    },

    # ══════════════════════════════════════════════════════════
    #  TIME SERIES
    # ══════════════════════════════════════════════════════════
    "prophet": {
        "display_name": "Prophet",
        "task_types": ["time_series"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Business Forecasting", "Seasonal Data", "Trend Analysis"],
        "strengths": [
            "Handles seasonality and holidays automatically",
            "Robust to missing data",
            "Easy to use with minimal tuning",
        ],
        "weaknesses": ["Struggles with non-seasonal data", "Not great for high-frequency data"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [100, 1000000],
    },
    "arima": {
        "display_name": "ARIMA",
        "task_types": ["time_series"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Stationary Time Series", "Short-Term Forecasting"],
        "strengths": ["Classical statistical approach", "Well-understood theory", "Fast training"],
        "weaknesses": ["Requires stationary data", "Cannot capture complex patterns", "Univariate only"],
        "min_dataset_size": 30,
        "ideal_dataset_range": [50, 100000],
    },
    "sarima": {
        "display_name": "SARIMA",
        "task_types": ["time_series"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Seasonal Time Series", "Monthly/Quarterly Forecasting"],
        "strengths": ["Handles seasonality explicitly", "Statistical confidence intervals", "Interpretable"],
        "weaknesses": ["Slow with many parameters", "Cannot handle multiple seasonalities"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [100, 100000],
    },
    "lstm": {
        "display_name": "LSTM",
        "task_types": ["time_series"],
        "parameters": "100K-10M",
        "accuracy_potential": "High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Medium",
        "hardware": "Low GPU",
        "use_cases": ["Complex Sequences", "Multi-Step Forecasting", "Multivariate Time Series"],
        "strengths": ["Captures long-range dependencies", "Handles multivariate data", "Flexible architecture"],
        "weaknesses": ["Requires large dataset", "Hard to tune", "Slow training"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [2000, 10000000],
    },
    "tft": {
        "display_name": "Temporal Fusion Transformer",
        "task_types": ["time_series"],
        "parameters": "5-50M",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "Medium GPU",
        "use_cases": ["Multi-Horizon Forecasting", "Interpretable DL", "Complex Time Series"],
        "strengths": [
            "State-of-the-art multi-horizon forecasting",
            "Built-in interpretability",
            "Handles static, known, and observed inputs",
        ],
        "weaknesses": ["Requires large dataset", "GPU needed", "Complex architecture"],
        "min_dataset_size": 2000,
        "ideal_dataset_range": [5000, 50000000],
    },
    "nbeats": {
        "display_name": "N-BEATS",
        "task_types": ["time_series"],
        "parameters": "1-10M",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "Low GPU",
        "use_cases": ["Univariate Forecasting", "Trend & Seasonality Decomposition"],
        "strengths": ["Pure deep learning approach", "Interpretable basis expansion", "No need for feature engineering"],
        "weaknesses": ["Univariate only", "Requires GPU for reasonable speed"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [1000, 5000000],
    },
    "deepar": {
        "display_name": "DeepAR",
        "task_types": ["time_series"],
        "parameters": "1-10M",
        "accuracy_potential": "High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Medium",
        "hardware": "Low GPU",
        "use_cases": ["Probabilistic Forecasting", "Multiple Related Time Series"],
        "strengths": ["Probabilistic predictions (uncertainty)", "Learns across multiple time series", "Good cold-start"],
        "weaknesses": ["Requires GPU", "Needs many related series for best results"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [2000, 10000000],
    },

    # ══════════════════════════════════════════════════════════
    #  NLP / TEXT CLASSIFICATION
    # ══════════════════════════════════════════════════════════
    "distilbert": {
        "display_name": "DistilBERT",
        "task_types": ["text_classification", "sentiment_analysis"],
        "parameters": "66M",
        "accuracy_potential": "High",
        "training_speed": "Fast",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "Low GPU",
        "use_cases": ["Sentiment Analysis", "Spam Detection", "Topic Classification"],
        "strengths": [
            "40% smaller than BERT with 97% of its performance",
            "Fast inference for production",
            "Great accuracy-to-compute ratio",
        ],
        "weaknesses": ["Slightly lower accuracy than full BERT", "Still requires GPU for fine-tuning"],
        "min_dataset_size": 200,
        "ideal_dataset_range": [1000, 100000],
    },
    "bert": {
        "display_name": "BERT Base",
        "task_types": ["text_classification", "sentiment_analysis"],
        "parameters": "110M",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Medium",
        "model_size": "Medium",
        "hardware": "Medium GPU",
        "use_cases": ["Enterprise NLP", "Document Classification", "Named Entity Recognition"],
        "strengths": [
            "Strong baseline for all NLP tasks",
            "Bidirectional context understanding",
            "Massive pretrained knowledge",
        ],
        "weaknesses": ["Larger and slower than DistilBERT", "512 token limit"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [2000, 500000],
    },
    "roberta": {
        "display_name": "RoBERTa",
        "task_types": ["text_classification", "sentiment_analysis"],
        "parameters": "125M",
        "accuracy_potential": "Very High",
        "training_speed": "Medium",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "Medium GPU",
        "use_cases": ["Research Projects", "Legal Document Analysis", "Medical NLP"],
        "strengths": [
            "Improved pretraining over BERT (more data, longer training)",
            "Better on diverse benchmarks",
            "Robust to domain shift",
        ],
        "weaknesses": ["Larger model, more GPU memory needed", "Slower fine-tuning"],
        "min_dataset_size": 1000,
        "ideal_dataset_range": [5000, 1000000],
    },
    "deberta": {
        "display_name": "DeBERTa V3",
        "task_types": ["text_classification", "sentiment_analysis"],
        "parameters": "184M",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "Medium GPU",
        "use_cases": ["State-of-the-Art NLP", "Complex Classification", "QA Systems"],
        "strengths": [
            "Disentangled attention mechanism",
            "State-of-the-art on SuperGLUE",
            "Better positional encoding",
        ],
        "weaknesses": ["Large model", "Slow training", "High VRAM requirement"],
        "min_dataset_size": 2000,
        "ideal_dataset_range": [5000, 1000000],
    },
    "t5": {
        "display_name": "T5 (Text-to-Text)",
        "task_types": ["text_classification", "sentiment_analysis"],
        "parameters": "220M-11B",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Slow",
        "model_size": "Very Large",
        "hardware": "High GPU",
        "use_cases": ["Multi-Task NLP", "Summarization", "Translation", "QA"],
        "strengths": [
            "Unified text-to-text framework for all NLP tasks",
            "State-of-the-art on many benchmarks",
            "Versatile — one model for many tasks",
        ],
        "weaknesses": ["Very large model", "Slow inference", "Requires significant GPU memory"],
        "min_dataset_size": 5000,
        "ideal_dataset_range": [10000, 5000000],
    },

    # ══════════════════════════════════════════════════════════
    #  COMPUTER VISION — Image Classification
    # ══════════════════════════════════════════════════════════
    "resnet18": {
        "display_name": "ResNet-18",
        "task_types": ["image_classification"],
        "parameters": "11.7M",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "Low GPU",
        "use_cases": ["Prototyping", "Quick Experiments", "Small Datasets"],
        "strengths": ["Very fast training", "Good baseline model", "Low resource requirements"],
        "weaknesses": ["Lower accuracy ceiling than deeper models"],
        "min_dataset_size": 100,
        "ideal_dataset_range": [200, 20000],
    },
    "resnet50": {
        "display_name": "ResNet-50",
        "task_types": ["image_classification"],
        "parameters": "25.6M",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "Medium GPU",
        "use_cases": ["Enterprise Systems", "Medical Imaging", "Quality Control"],
        "strengths": [
            "Strong feature extraction backbone",
            "Well-studied with many pretrained weights",
            "Good transfer learning performance",
        ],
        "weaknesses": ["Larger than EfficientNet for similar accuracy"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [2000, 100000],
    },
    "efficientnet_b0": {
        "display_name": "EfficientNet-B0",
        "task_types": ["image_classification"],
        "parameters": "5.3M",
        "accuracy_potential": "High",
        "training_speed": "Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "Low GPU",
        "use_cases": ["Mobile Apps", "Edge Devices", "Real-Time Detection"],
        "strengths": [
            "Excellent accuracy-to-compute ratio",
            "Compound scaling for balanced dimensions",
            "Small memory footprint",
        ],
        "weaknesses": ["Less accurate than larger models on complex datasets"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [1000, 50000],
    },
    "efficientnet_b3": {
        "display_name": "EfficientNet-B3",
        "task_types": ["image_classification"],
        "parameters": "12M",
        "accuracy_potential": "Very High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "Medium GPU",
        "use_cases": ["Production Systems", "Medical Imaging", "Fine-Grained Classification"],
        "strengths": ["Higher accuracy than B0", "Still efficient", "Excellent transfer learning"],
        "weaknesses": ["Needs more GPU memory than B0"],
        "min_dataset_size": 1000,
        "ideal_dataset_range": [2000, 200000],
    },
    "mobilenet_v3": {
        "display_name": "MobileNet V3",
        "task_types": ["image_classification"],
        "parameters": "2.5M",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Mobile Apps", "IoT Devices", "Embedded Systems"],
        "strengths": [
            "Ultra-fast inference, designed for mobile",
            "Runs efficiently on CPU",
            "Smallest model footprint",
        ],
        "weaknesses": ["Lower accuracy ceiling on complex datasets"],
        "min_dataset_size": 200,
        "ideal_dataset_range": [500, 30000],
    },
    "vit_b_16": {
        "display_name": "Vision Transformer (ViT-B/16)",
        "task_types": ["image_classification"],
        "parameters": "86M",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "High GPU",
        "use_cases": ["Research Projects", "Medical Imaging", "Satellite Analysis"],
        "strengths": [
            "State-of-the-art accuracy on large datasets",
            "Global attention captures long-range dependencies",
            "Excellent for fine-grained classification",
        ],
        "weaknesses": ["Requires large dataset (10k+)", "High GPU memory", "Slower training"],
        "min_dataset_size": 5000,
        "ideal_dataset_range": [10000, 1000000],
    },
    "convnext_tiny": {
        "display_name": "ConvNeXt Tiny",
        "task_types": ["image_classification"],
        "parameters": "28.6M",
        "accuracy_potential": "Very High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "Medium GPU",
        "use_cases": ["Enterprise Systems", "Industrial Inspection", "Autonomous Vehicles"],
        "strengths": [
            "Modern CNN rivaling Transformers",
            "Better training efficiency than ViT",
            "Strong transfer learning",
        ],
        "weaknesses": ["Newer architecture, fewer community resources"],
        "min_dataset_size": 1000,
        "ideal_dataset_range": [2000, 200000],
    },

    # ══════════════════════════════════════════════════════════
    #  OBJECT DETECTION
    # ══════════════════════════════════════════════════════════
    "yolov8n": {
        "display_name": "YOLOv8 Nano",
        "task_types": ["object_detection"],
        "parameters": "3.2M",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Real-Time Detection", "Mobile Apps", "Edge Devices"],
        "strengths": ["Fastest YOLO variant", "Runs on CPU", "Real-time capable"],
        "weaknesses": ["Lower accuracy on small objects"],
        "min_dataset_size": 100,
        "ideal_dataset_range": [500, 20000],
    },
    "yolov8s": {
        "display_name": "YOLOv8 Small",
        "task_types": ["object_detection"],
        "parameters": "11.2M",
        "accuracy_potential": "High",
        "training_speed": "Fast",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "Low GPU",
        "use_cases": ["Surveillance", "Traffic Monitoring", "Retail Analytics"],
        "strengths": ["Good accuracy-speed balance", "Versatile"],
        "weaknesses": ["Needs GPU for best performance"],
        "min_dataset_size": 300,
        "ideal_dataset_range": [1000, 50000],
    },
    "yolov8m": {
        "display_name": "YOLOv8 Medium",
        "task_types": ["object_detection"],
        "parameters": "25.9M",
        "accuracy_potential": "High",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Medium",
        "hardware": "Medium GPU",
        "use_cases": ["Autonomous Driving", "Industrial Inspection", "Security"],
        "strengths": ["Strong accuracy on complex scenes", "Robust to occlusion"],
        "weaknesses": ["Slower than nano/small variants"],
        "min_dataset_size": 500,
        "ideal_dataset_range": [2000, 100000],
    },
    "detr": {
        "display_name": "DETR (Detection Transformer)",
        "task_types": ["object_detection"],
        "parameters": "41M",
        "accuracy_potential": "Very High",
        "training_speed": "Slow",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "High GPU",
        "use_cases": ["Research", "Complex Scenes", "Instance Segmentation"],
        "strengths": ["End-to-end detection (no NMS needed)", "Set-based prediction", "Good for complex scenes"],
        "weaknesses": ["Slow training convergence", "High GPU requirement", "Needs large dataset"],
        "min_dataset_size": 5000,
        "ideal_dataset_range": [10000, 500000],
    },

    # ══════════════════════════════════════════════════════════
    #  ANOMALY DETECTION
    # ══════════════════════════════════════════════════════════
    "isolation_forest": {
        "display_name": "Isolation Forest",
        "task_types": ["anomaly_detection"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Fraud Detection", "Intrusion Detection", "Manufacturing QC"],
        "strengths": ["Efficient on high-dimensional data", "No need for labeled anomalies", "Scales well"],
        "weaknesses": ["May miss local anomalies", "Hyperparameter sensitive"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [200, 10000000],
    },
    "one_class_svm": {
        "display_name": "One-Class SVM",
        "task_types": ["anomaly_detection"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Medium",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Novelty Detection", "Small Datasets"],
        "strengths": ["Works well on small datasets", "Kernel-based flexibility"],
        "weaknesses": ["Slow on large datasets", "Sensitive to scaling"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 50000],
    },
    "lof": {
        "display_name": "Local Outlier Factor",
        "task_types": ["anomaly_detection"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Fast",
        "inference_speed": "Medium",
        "model_size": "Large",
        "hardware": "CPU",
        "use_cases": ["Local Anomaly Detection", "Density-Based Analysis"],
        "strengths": ["Detects local anomalies well", "Density-based approach"],
        "weaknesses": ["Memory intensive", "Slow on large datasets"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [100, 100000],
    },

    # ══════════════════════════════════════════════════════════
    #  CLUSTERING
    # ══════════════════════════════════════════════════════════
    "kmeans": {
        "display_name": "K-Means",
        "task_types": ["clustering"],
        "parameters": "N/A",
        "accuracy_potential": "Medium",
        "training_speed": "Very Fast",
        "inference_speed": "Very Fast",
        "model_size": "Tiny",
        "hardware": "CPU",
        "use_cases": ["Customer Segmentation", "Image Compression", "Feature Engineering"],
        "strengths": ["Simple and fast", "Scalable to large datasets", "Easy to interpret"],
        "weaknesses": ["Assumes spherical clusters", "Must specify K", "Sensitive to initialization"],
        "min_dataset_size": 20,
        "ideal_dataset_range": [50, 10000000],
    },
    "dbscan": {
        "display_name": "DBSCAN",
        "task_types": ["clustering"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Fast",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Arbitrary Shape Clusters", "Noise Detection", "Spatial Data"],
        "strengths": ["No need to specify K", "Finds arbitrary-shaped clusters", "Identifies noise points"],
        "weaknesses": ["Sensitive to eps parameter", "Struggles with varying density"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [100, 1000000],
    },
    "gmm": {
        "display_name": "Gaussian Mixture Model",
        "task_types": ["clustering"],
        "parameters": "N/A",
        "accuracy_potential": "High",
        "training_speed": "Fast",
        "inference_speed": "Fast",
        "model_size": "Small",
        "hardware": "CPU",
        "use_cases": ["Soft Clustering", "Density Estimation", "Generative Modeling"],
        "strengths": ["Soft cluster assignments", "Models cluster shape", "Probabilistic framework"],
        "weaknesses": ["Assumes Gaussian distribution", "Sensitive to initialization"],
        "min_dataset_size": 50,
        "ideal_dataset_range": [100, 500000],
    },
}


# ── Recommendation Engine ─────────────────────────────────────

def _detect_task_type(profile: dict) -> str:
    """Auto-detect task type from dataset profile."""
    # Prefer the analyzer's detection if available
    if profile.get("problem_type") and profile["problem_type"] != "unknown":
        return profile["problem_type"]

    dataset_type = profile.get("dataset_type", "tabular")

    if dataset_type == "image":
        img_meta = profile.get("image_metadata", {})
        if img_meta.get("has_annotations"):
            return "object_detection"
        return "image_classification"

    if dataset_type == "text":
        return "text_classification"

    if dataset_type == "time_series":
        return "time_series_forecasting"

    # Tabular: check target column type
    target_col = profile.get("target_column")
    target_analysis = profile.get("target_analysis")

    if target_analysis:
        if target_analysis.get("type") == "categorical":
            return "tabular_classification"
        elif target_analysis.get("type") == "continuous":
            return "tabular_regression"

    if target_col:
        col_info = profile.get("columns_info", {})
        if isinstance(col_info, dict):
            dtype = col_info.get(target_col, {}).get("dtype", "")
        elif isinstance(col_info, list):
            dtype = next(
                (c.get("dtype", "") for c in col_info if c.get("name") == target_col),
                "",
            )
        else:
            dtype = ""

        if dtype in ("float64", "float32", "int64", "int32"):
            unique = 100
            if isinstance(col_info, dict):
                unique = col_info.get(target_col, {}).get("unique", 100)
            elif isinstance(col_info, list):
                unique = next(
                    (c.get("unique_count", 100) for c in col_info if c.get("name") == target_col),
                    100,
                )
            if unique <= 20:
                return "tabular_classification"
            return "tabular_regression"

    return "tabular_classification"


def _score_model(model_key: str, model_info: dict, profile: dict) -> float:
    """Score a model's suitability for the given dataset. Higher = better."""
    score = 50.0  # base

    dataset_size = (
        profile.get("row_count")
        or profile.get("image_metadata", {}).get("total_images", 1000)
    )
    ideal_range = model_info.get("ideal_dataset_range", [100, 100000])

    # Dataset size fit (0 to 25 points)
    if ideal_range[0] <= dataset_size <= ideal_range[1]:
        score += 20
    elif dataset_size < ideal_range[0]:
        # Penalize proportionally
        ratio = dataset_size / max(ideal_range[0], 1)
        score -= max(5, 20 * (1 - ratio))
    elif dataset_size > ideal_range[1]:
        score += 5  # Still works, just slower

    # Accuracy potential (0 to 25 points)
    acc = model_info.get("accuracy_potential", "Medium")
    acc_map = {"Low": 0, "Medium": 8, "High": 16, "Very High": 25}
    score += acc_map.get(acc, 5)

    # Speed bonus for smaller datasets
    if dataset_size < 5000:
        speed = model_info.get("training_speed", "Medium")
        speed_map = {"Very Fast": 12, "Fast": 8, "Medium": 0, "Slow": -8}
        score += speed_map.get(speed, 0)

    # Speed bonus for very large datasets
    if dataset_size > 100000:
        speed = model_info.get("training_speed", "Medium")
        speed_map = {"Very Fast": 10, "Fast": 5, "Medium": 0, "Slow": -5}
        score += speed_map.get(speed, 0)

    # Hardware accessibility
    hw = model_info.get("hardware", "CPU")
    hw_penalty = {"CPU": 5, "Low GPU": 0, "Medium GPU": -5, "High GPU": -10}
    score += hw_penalty.get(hw, 0)

    # Categorical feature bonus
    dq = profile.get("data_quality", {})
    cat_cols = dq.get("categorical_columns", 0)
    total_cols = profile.get("column_count", 1)
    if cat_cols > 0 and cat_cols / max(total_cols, 1) > 0.3:
        if "categorical" in " ".join(model_info.get("strengths", [])).lower():
            score += 8

    # Missing value handling bonus
    missing_pct = dq.get("missing_pct", 0)
    if missing_pct > 5:
        if "missing" in " ".join(model_info.get("strengths", [])).lower():
            score += 5

    # Class imbalance awareness
    target = profile.get("target_analysis", {})
    if target and target.get("is_imbalanced"):
        # Some models handle imbalance better
        if model_key in ("xgboost", "lightgbm", "catboost"):
            score += 5  # These have class_weight or scale_pos_weight

    return round(score, 1)


def get_recommendations(
    profile: dict,
    task_type: Optional[str] = None,
    top_n: int = 8,
) -> dict:
    """
    Generate ranked model recommendations for a dataset.

    Args:
        profile: Dataset profile dict (from DatasetAnalyzer or profiling service)
        task_type: Optional override. Auto-detected if not provided.
        top_n: Number of recommendations to return.

    Returns:
        Dict with task_type, dataset_summary, and ranked recommendations.
    """
    if not task_type:
        task_type = _detect_task_type(profile)

    # Map problem types to model task types
    TASK_TYPE_MAP = {
        "tabular_classification": ["tabular_classification"],
        "tabular_regression": ["tabular_regression"],
        "time_series_forecasting": ["time_series"],
        "clustering": ["clustering"],
        "anomaly_detection": ["anomaly_detection"],
        "text_classification": ["text_classification", "sentiment_analysis"],
        "image_classification": ["image_classification"],
        "object_detection": ["object_detection"],
        "nlp": ["text_classification", "sentiment_analysis"],
        "recommendation": ["tabular_classification"],
    }
    compatible_tasks = TASK_TYPE_MAP.get(task_type, [task_type])

    # Filter and score models
    candidates = []
    for key, info in MODEL_DB.items():
        model_tasks = info.get("task_types", [])
        if any(t in compatible_tasks for t in model_tasks):
            score = _score_model(key, info, profile)
            candidates.append((key, info, score))

    # Sort by score descending
    candidates.sort(key=lambda x: x[2], reverse=True)
    candidates = candidates[:top_n]

    # Build dataset summary
    dataset_size = (
        profile.get("row_count")
        or profile.get("image_metadata", {}).get("total_images", 0)
    )
    target_analysis = profile.get("target_analysis") or {}
    num_classes = target_analysis.get("num_classes", 0)
    num_features = profile.get("column_count", 0)

    dataset_summary = {
        "dataset_size": dataset_size,
        "num_classes": num_classes,
        "num_features": num_features,
        "dataset_type": profile.get("dataset_type", "tabular"),
        "quality_score": profile.get("quality_score", 50),
    }

    recommendations = []
    for rank, (key, info, score) in enumerate(candidates, 1):
        rec = {
            "rank": rank,
            "model_key": key,
            "display_name": info["display_name"],
            "parameters": info.get("parameters", "N/A"),
            "accuracy_potential": info["accuracy_potential"],
            "training_speed": info["training_speed"],
            "inference_speed": info["inference_speed"],
            "model_size": info["model_size"],
            "hardware": info["hardware"],
            "use_cases": info["use_cases"],
            "strengths": info["strengths"],
            "weaknesses": info.get("weaknesses", []),
            "suitability_score": score,
            "is_recommended": rank == 1,
            "explanation": _generate_explanation(key, info, profile, task_type, rank),
        }
        recommendations.append(rec)

    return {
        "task_type": task_type,
        "task_type_display": task_type.replace("_", " ").title(),
        "dataset_summary": dataset_summary,
        "recommendations": recommendations,
        "total_models_evaluated": len(MODEL_DB),
    }


def _generate_explanation(
    model_key: str,
    model_info: dict,
    profile: dict,
    task_type: str,
    rank: int,
) -> str:
    """Generate a human-readable explanation for why a model is recommended."""
    name = model_info["display_name"]
    dataset_size = (
        profile.get("row_count")
        or profile.get("image_metadata", {}).get("total_images", 0)
    )
    acc = model_info["accuracy_potential"]
    speed = model_info["training_speed"]
    hw = model_info["hardware"]

    parts = []

    if rank == 1:
        parts.append(f"{name} is your best match for this dataset.")
    else:
        parts.append(f"{name} is a strong alternative worth considering.")

    # Size reasoning
    ideal = model_info.get("ideal_dataset_range", [100, 100000])
    if ideal[0] <= dataset_size <= ideal[1]:
        parts.append(
            f"Your dataset of {dataset_size:,} samples is within the ideal range for {name}."
        )
    elif dataset_size < ideal[0]:
        if speed in ("Very Fast", "Fast"):
            parts.append(
                f"With a smaller dataset of {dataset_size:,} samples, "
                f"this model's {speed.lower()} training avoids overfitting."
            )
        else:
            parts.append(
                f"Your dataset has {dataset_size:,} samples — pretrained weights "
                f"and transfer learning can compensate."
            )
    elif dataset_size > ideal[1]:
        parts.append(
            f"Your large dataset of {dataset_size:,} samples can leverage {name}'s "
            f"{acc.lower()} accuracy potential."
        )

    # Hardware reasoning
    if hw == "CPU":
        parts.append("Runs on CPU — no GPU required.")
    elif hw == "Low GPU":
        parts.append("Only a basic GPU is needed, making this accessible on most machines.")
    elif hw == "High GPU":
        parts.append(
            "Requires a powerful GPU (16GB+ VRAM). "
            "Consider cloud services like Google Colab Pro if needed."
        )

    # Key strength
    if model_info.get("strengths"):
        parts.append(f"Key advantage: {model_info['strengths'][0].lower()}.")

    return " ".join(parts)


def get_model_detail(model_key: str) -> Optional[dict]:
    """Get detailed info for a specific model."""
    info = MODEL_DB.get(model_key)
    if not info:
        return None
    return {
        "model_key": model_key,
        **info,
    }
