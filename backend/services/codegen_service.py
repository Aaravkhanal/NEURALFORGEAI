"""
NeuralForge — Code Generation Service
Generates production-ready training code for PyTorch, TensorFlow, and Scikit-Learn.
Templates are customized based on dataset profile, model choice, and task type.
"""

import logging
from typing import Optional

logger = logging.getLogger("neuralforge.codegen")


def generate_training_code(
    model_key: str,
    task_type: str,
    framework: str,
    dataset_info: dict,
    target_column: Optional[str] = None,
) -> dict:
    """
    Generate complete training code for a model + framework combination.

    Returns dict with 'code', 'requirements', 'readme' keys.
    """
    framework = framework.lower().strip()
    generators = {
        "pytorch": _gen_pytorch,
        "tensorflow": _gen_tensorflow,
        "scikit-learn": _gen_sklearn,
        "sklearn": _gen_sklearn,
        "xgboost": _gen_xgboost,
        "catboost": _gen_catboost,
        "lightgbm": _gen_lightgbm,
        "huggingface": _gen_huggingface,
        "transformers": _gen_huggingface,
    }

    gen = generators.get(framework)
    if not gen:
        raise ValueError(f"Unsupported framework: {framework}. Use: pytorch, tensorflow, scikit-learn, xgboost, catboost, lightgbm, huggingface")

    return gen(model_key, task_type, dataset_info, target_column)


# ── PyTorch Generator ─────────────────────────────────────────

def _gen_pytorch(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    num_classes = info.get("num_classes", 2)
    num_features = info.get("num_features", 10)
    columns = info.get("columns", [])
    col_names_str = ", ".join(f'"{c}"' for c in columns[:10]) if columns else '"feature1", "feature2"'

    if "image" in task_type:
        code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: {model_key} | Task: {task_type} | Framework: PyTorch
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
from pathlib import Path
import json
import time

# ── Configuration ──────────────────────────────────────────
DATASET_DIR = "./dataset"        # Path to your image dataset folder
NUM_CLASSES = {num_classes}
BATCH_SIZE = 32
EPOCHS = 20
LEARNING_RATE = 0.001
DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"

print(f"Using device: {{DEVICE}}")

# ── Data Transforms ────────────────────────────────────────
train_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

val_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ── Dataset Loading ────────────────────────────────────────
train_dataset = datasets.ImageFolder(f"{{DATASET_DIR}}/train", transform=train_transform)
val_dataset = datasets.ImageFolder(f"{{DATASET_DIR}}/val", transform=val_transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

print(f"Train samples: {{len(train_dataset)}}, Val samples: {{len(val_dataset)}}")
print(f"Classes: {{train_dataset.classes}}")

# ── Model Definition ───────────────────────────────────────
model = models.{model_key}(weights="DEFAULT")
if hasattr(model, "fc"):
    model.fc = nn.Linear(model.fc.in_features, NUM_CLASSES)
elif hasattr(model, "classifier"):
    if isinstance(model.classifier, nn.Sequential):
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, NUM_CLASSES)
    else:
        model.classifier = nn.Linear(model.classifier.in_features, NUM_CLASSES)
elif hasattr(model, "heads"):
    model.heads.head = nn.Linear(model.heads.head.in_features, NUM_CLASSES)

model = model.to(DEVICE)

# ── Training Setup ─────────────────────────────────────────
criterion = nn.CrossEntropyLoss()
optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

# ── Training Loop ──────────────────────────────────────────
best_acc = 0.0
history = {{"train_loss": [], "val_loss": [], "train_acc": [], "val_acc": []}}

for epoch in range(EPOCHS):
    # Training phase
    model.train()
    running_loss, correct, total = 0.0, 0, 0

    for batch_idx, (images, labels) in enumerate(train_loader):
        images, labels = images.to(DEVICE), labels.to(DEVICE)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item()
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()

    train_loss = running_loss / len(train_loader)
    train_acc = 100.0 * correct / total

    # Validation phase
    model.eval()
    val_loss, val_correct, val_total = 0.0, 0, 0

    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            outputs = model(images)
            loss = criterion(outputs, labels)
            val_loss += loss.item()
            _, predicted = outputs.max(1)
            val_total += labels.size(0)
            val_correct += predicted.eq(labels).sum().item()

    val_loss /= len(val_loader)
    val_acc = 100.0 * val_correct / val_total

    scheduler.step()

    # Logging
    history["train_loss"].append(train_loss)
    history["val_loss"].append(val_loss)
    history["train_acc"].append(train_acc)
    history["val_acc"].append(val_acc)

    print(f"Epoch [{{epoch+1}}/{{EPOCHS}}] "
          f"Train Loss: {{train_loss:.4f}} | Train Acc: {{train_acc:.2f}}% | "
          f"Val Loss: {{val_loss:.4f}} | Val Acc: {{val_acc:.2f}}%")

    # Save best model
    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), "best_model.pth")
        print(f"  → Saved best model ({{val_acc:.2f}}%)")

# ── Save Results ───────────────────────────────────────────
print(f"\\nTraining complete! Best accuracy: {{best_acc:.2f}}%")
torch.save(model.state_dict(), "final_model.pth")

with open("training_history.json", "w") as f:
    json.dump(history, f, indent=2)

print("Saved: best_model.pth, final_model.pth, training_history.json")
'''
    else:  # tabular / text with PyTorch
        code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: {model_key} | Task: {task_type} | Framework: PyTorch
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import json

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"
BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 0.001
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Using device: {{DEVICE}}")

# ── Data Loading & Preprocessing ───────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")
print(f"Target column: {{TARGET_COLUMN}}")

# Separate features and target
X = df.drop(columns=[TARGET_COLUMN])
y = df[TARGET_COLUMN]

# Encode categorical features
for col in X.select_dtypes(include=["object", "category"]).columns:
    X[col] = LabelEncoder().fit_transform(X[col].astype(str))

# Encode target
le_target = LabelEncoder()
y = le_target.fit_transform(y)
NUM_CLASSES = len(le_target.classes_)
NUM_FEATURES = X.shape[1]

print(f"Features: {{NUM_FEATURES}}, Classes: {{NUM_CLASSES}}")

# Split data
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# Scale features
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_val = scaler.transform(X_val)

# Convert to tensors
X_train_t = torch.FloatTensor(X_train).to(DEVICE)
y_train_t = torch.LongTensor(y_train).to(DEVICE)
X_val_t = torch.FloatTensor(X_val).to(DEVICE)
y_val_t = torch.LongTensor(y_val).to(DEVICE)

train_ds = TensorDataset(X_train_t, y_train_t)
train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)

# ── Model Definition ───────────────────────────────────────
class NeuralNet(nn.Module):
    def __init__(self, input_dim, num_classes):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes),
        )

    def forward(self, x):
        return self.net(x)

model = NeuralNet(NUM_FEATURES, NUM_CLASSES).to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

# ── Training Loop ──────────────────────────────────────────
best_acc = 0.0
history = {{"train_loss": [], "val_loss": [], "val_acc": []}}

for epoch in range(EPOCHS):
    model.train()
    epoch_loss = 0.0
    for X_batch, y_batch in train_loader:
        optimizer.zero_grad()
        outputs = model(X_batch)
        loss = criterion(outputs, y_batch)
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()

    epoch_loss /= len(train_loader)

    # Validation
    model.eval()
    with torch.no_grad():
        val_out = model(X_val_t)
        val_loss = criterion(val_out, y_val_t).item()
        val_preds = val_out.argmax(dim=1).cpu().numpy()
        val_acc = accuracy_score(y_val, val_preds) * 100

    scheduler.step(val_loss)
    history["train_loss"].append(epoch_loss)
    history["val_loss"].append(val_loss)
    history["val_acc"].append(val_acc)

    if (epoch + 1) % 5 == 0 or val_acc > best_acc:
        print(f"Epoch [{{epoch+1}}/{{EPOCHS}}] Loss: {{epoch_loss:.4f}} | Val Loss: {{val_loss:.4f}} | Val Acc: {{val_acc:.2f}}%")

    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), "best_model.pth")

# ── Evaluation ─────────────────────────────────────────────
model.load_state_dict(torch.load("best_model.pth", weights_only=True))
model.eval()
with torch.no_grad():
    final_preds = model(X_val_t).argmax(dim=1).cpu().numpy()

print(f"\\n{'='*50}")
print(f"Best Validation Accuracy: {{best_acc:.2f}}%")
print(f"{'='*50}")
print(classification_report(y_val, final_preds, target_names=[str(c) for c in le_target.classes_]))

torch.save(model.state_dict(), "final_model.pth")
with open("training_history.json", "w") as f:
    json.dump(history, f, indent=2)

print("\\nSaved: best_model.pth, final_model.pth, training_history.json")
'''

    requirements = _get_requirements(framework="pytorch", task_type=task_type)
    readme = _get_readme(model_key, task_type, "PyTorch", filename)

    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── Scikit-Learn Generator ────────────────────────────────────

def _gen_sklearn(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    is_regression = "regression" in task_type

    model_import_map = {
        "xgboost": ("from xgboost import XGBClassifier, XGBRegressor", "XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)" if not is_regression else "XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)"),
        "lightgbm": ("from lightgbm import LGBMClassifier, LGBMRegressor", "LGBMClassifier(n_estimators=200, max_depth=-1, learning_rate=0.1, random_state=42)" if not is_regression else "LGBMRegressor(n_estimators=200, max_depth=-1, learning_rate=0.1, random_state=42)"),
        "catboost": ("from catboost import CatBoostClassifier, CatBoostRegressor", "CatBoostClassifier(iterations=200, depth=6, learning_rate=0.1, random_state=42, verbose=50)" if not is_regression else "CatBoostRegressor(iterations=200, depth=6, learning_rate=0.1, random_state=42, verbose=50)"),
        "random_forest": ("from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor", "RandomForestClassifier(n_estimators=200, max_depth=None, random_state=42, n_jobs=-1)" if not is_regression else "RandomForestRegressor(n_estimators=200, max_depth=None, random_state=42, n_jobs=-1)"),
        "gradient_boosting": ("from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor", "GradientBoostingClassifier(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)" if not is_regression else "GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)"),
    }

    import_line, model_init = model_import_map.get(
        model_key,
        ("from sklearn.ensemble import RandomForestClassifier", "RandomForestClassifier(n_estimators=200, random_state=42)"),
    )

    metrics_code = """
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
y_pred = model.predict(X_test)
print(f"\\nAccuracy: {accuracy_score(y_test, y_pred)*100:.2f}%")
print(f"\\nClassification Report:")
print(classification_report(y_test, y_pred))
""" if not is_regression else """
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
y_pred = model.predict(X_test)
print(f"\\nR² Score: {r2_score(y_test, y_pred):.4f}")
print(f"RMSE: {mean_squared_error(y_test, y_pred, squared=False):.4f}")
print(f"MAE: {mean_absolute_error(y_test, y_pred):.4f}")
"""

    code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: {model_key} | Task: {task_type} | Framework: Scikit-Learn
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
import json
import time
{import_line}

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"

# ── Data Loading ───────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")
print(f"Target column: {{TARGET_COLUMN}}")
print(f"Target distribution:\\n{{df[TARGET_COLUMN].value_counts()}}")

# ── Preprocessing ──────────────────────────────────────────
X = df.drop(columns=[TARGET_COLUMN])
y = df[TARGET_COLUMN]

# Encode categorical columns
label_encoders = {{}}
for col in X.select_dtypes(include=["object", "category"]).columns:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col].astype(str))
    label_encoders[col] = le

# Handle missing values
X = X.fillna(X.median(numeric_only=True))

# Encode target if categorical
target_le = None
if y.dtype == "object":
    target_le = LabelEncoder()
    y = target_le.fit_transform(y)

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42{", stratify=y" if not is_regression else ""}
)
print(f"Train: {{X_train.shape[0]}}, Test: {{X_test.shape[0]}}")

# ── Model Training ─────────────────────────────────────────
print("\\nTraining {model_key}...")
start = time.time()

model = {model_init}
model.fit(X_train, y_train)

elapsed = time.time() - start
print(f"Training completed in {{elapsed:.1f}}s")

# ── Cross Validation ───────────────────────────────────────
cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="{"accuracy" if not is_regression else "r2"}")
print(f"Cross-validation {"accuracy" if not is_regression else "R²"}: {{cv_scores.mean()*100:.2f}}% (+/- {{cv_scores.std()*100:.2f}}%)")

# ── Evaluation ─────────────────────────────────────────────
{metrics_code}

# ── Feature Importance ─────────────────────────────────────
if hasattr(model, "feature_importances_"):
    importances = pd.Series(model.feature_importances_, index=X.columns)
    print("\\nTop 10 Important Features:")
    print(importances.nlargest(10).to_string())

# ── Save Model ─────────────────────────────────────────────
joblib.dump(model, "trained_model.joblib")
joblib.dump({{"scaler": None, "label_encoders": {{k: list(v.classes_) for k, v in label_encoders.items()}}}}, "preprocessors.joblib")

results = {{
    "model": "{model_key}",
    "framework": "scikit-learn",
    "cv_mean": float(cv_scores.mean()),
    "cv_std": float(cv_scores.std()),
    "training_time": elapsed,
}}
with open("training_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\\nSaved: trained_model.joblib, preprocessors.joblib, training_results.json")
'''

    requirements = _get_requirements(framework="sklearn", task_type=task_type, model_key=model_key)
    readme = _get_readme(model_key, task_type, "Scikit-Learn", filename)

    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── TensorFlow Generator ─────────────────────────────────────

def _gen_tensorflow(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    num_classes = info.get("num_classes", 2)

    if "image" in task_type:
        code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: {model_key} | Task: {task_type} | Framework: TensorFlow/Keras
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import json

# ── Configuration ──────────────────────────────────────────
DATASET_DIR = "./dataset"
NUM_CLASSES = {num_classes}
BATCH_SIZE = 32
EPOCHS = 20
IMG_SIZE = (224, 224)

print(f"TensorFlow version: {{tf.__version__}}")
print(f"GPU available: {{len(tf.config.list_physical_devices('GPU')) > 0}}")

# ── Data Loading ───────────────────────────────────────────
train_ds = keras.utils.image_dataset_from_directory(
    f"{{DATASET_DIR}}/train", image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode="int",
)
val_ds = keras.utils.image_dataset_from_directory(
    f"{{DATASET_DIR}}/val", image_size=IMG_SIZE, batch_size=BATCH_SIZE, label_mode="int",
)

class_names = train_ds.class_names
print(f"Classes: {{class_names}}")

# Performance optimization
AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

# ── Data Augmentation ──────────────────────────────────────
data_augmentation = keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.1),
    layers.RandomZoom(0.1),
    layers.RandomContrast(0.1),
])

# ── Model Definition ───────────────────────────────────────
base_model = keras.applications.EfficientNetB0(
    weights="imagenet", include_top=False, input_shape=(*IMG_SIZE, 3),
)
base_model.trainable = False  # Freeze for transfer learning

model = keras.Sequential([
    layers.Input(shape=(*IMG_SIZE, 3)),
    data_augmentation,
    layers.Rescaling(1.0 / 255),
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.Dropout(0.3),
    layers.Dense(128, activation="relu"),
    layers.Dropout(0.2),
    layers.Dense(NUM_CLASSES, activation="softmax"),
])

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

model.summary()

# ── Training ───────────────────────────────────────────────
callbacks = [
    keras.callbacks.ModelCheckpoint("best_model.keras", save_best_only=True, monitor="val_accuracy"),
    keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
    keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3),
]

history = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, callbacks=callbacks)

# ── Save Results ───────────────────────────────────────────
model.save("final_model.keras")
with open("training_history.json", "w") as f:
    json.dump({{k: [float(v) for v in vals] for k, vals in history.history.items()}}, f, indent=2)

val_loss, val_acc = model.evaluate(val_ds)
print(f"\\nFinal Validation Accuracy: {{val_acc*100:.2f}}%")
print("Saved: best_model.keras, final_model.keras, training_history.json")
'''
    else:
        code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: {model_key} | Task: {task_type} | Framework: TensorFlow/Keras
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
import json

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"
BATCH_SIZE = 64
EPOCHS = 50

# ── Data Loading ───────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")

X = df.drop(columns=[TARGET_COLUMN])
y = df[TARGET_COLUMN]

for col in X.select_dtypes(include=["object", "category"]).columns:
    X[col] = LabelEncoder().fit_transform(X[col].astype(str))

le = LabelEncoder()
y = le.fit_transform(y)
NUM_CLASSES = len(le.classes_)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# ── Model ──────────────────────────────────────────────────
model = keras.Sequential([
    layers.Input(shape=(X_train.shape[1],)),
    layers.Dense(256, activation="relu"),
    layers.BatchNormalization(),
    layers.Dropout(0.3),
    layers.Dense(128, activation="relu"),
    layers.BatchNormalization(),
    layers.Dropout(0.2),
    layers.Dense(64, activation="relu"),
    layers.Dense(NUM_CLASSES, activation="softmax"),
])

model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.summary()

# ── Training ───────────────────────────────────────────────
history = model.fit(
    X_train, y_train, validation_data=(X_test, y_test),
    epochs=EPOCHS, batch_size=BATCH_SIZE,
    callbacks=[
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ModelCheckpoint("best_model.keras", save_best_only=True),
    ],
)

# ── Evaluation ─────────────────────────────────────────────
loss, accuracy = model.evaluate(X_test, y_test)
print(f"\\nTest Accuracy: {{accuracy*100:.2f}}%")

model.save("final_model.keras")
with open("training_history.json", "w") as f:
    json.dump({{k: [float(v) for v in vals] for k, vals in history.history.items()}}, f, indent=2)

print("Saved: best_model.keras, final_model.keras, training_history.json")
'''

    requirements = _get_requirements(framework="tensorflow", task_type=task_type)
    readme = _get_readme(model_key, task_type, "TensorFlow", filename)

    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── XGBoost Native Generator ─────────────────────────────────

def _gen_xgboost(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    is_regression = "regression" in task_type

    objective = '"reg:squarederror"' if is_regression else '"multi:softprob"'
    eval_metric = '"rmse"' if is_regression else '"mlogloss"'
    metrics_code = """from sklearn.metrics import mean_squared_error, r2_score
y_pred = bst.predict(dtest)
print(f"R² Score: {r2_score(y_test, y_pred):.4f}")
print(f"RMSE: {mean_squared_error(y_test, y_pred, squared=False):.4f}")
""" if is_regression else """from sklearn.metrics import accuracy_score, classification_report
y_pred_proba = bst.predict(dtest)
y_pred = y_pred_proba.argmax(axis=1)
print(f"Accuracy: {accuracy_score(y_test, y_pred)*100:.2f}%")
print(classification_report(y_test, y_pred))
"""

    code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: XGBoost (Native API) | Task: {task_type}
"""

import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import json
import time

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"

PARAMS = {{
    "objective": {objective},
    "eval_metric": {eval_metric},
    "max_depth": 6,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 3,
    "tree_method": "hist",
    "device": "cpu",
    "seed": 42,
{"    'num_class': 2," if not is_regression else ""}
}}
NUM_BOOST_ROUND = 500
EARLY_STOPPING = 20

# ── Data Loading ───────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")

X = df.drop(columns=[TARGET_COLUMN])
y = df[TARGET_COLUMN]

# Encode categoricals
for col in X.select_dtypes(include=["object", "category"]).columns:
    X[col] = LabelEncoder().fit_transform(X[col].astype(str))

if y.dtype == "object":
    le = LabelEncoder()
    y = le.fit_transform(y)
    PARAMS["num_class"] = len(le.classes_)

X.fillna(X.median(numeric_only=True), inplace=True)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── XGBoost DMatrix ────────────────────────────────────────
dtrain = xgb.DMatrix(X_train, label=y_train, enable_categorical=True)
dtest = xgb.DMatrix(X_test, label=y_test, enable_categorical=True)

evals = [(dtrain, "train"), (dtest, "eval")]

# ── Training (Native API) ─────────────────────────────────
print("\\nTraining XGBoost (native API)...")
start = time.time()

bst = xgb.train(
    PARAMS,
    dtrain,
    num_boost_round=NUM_BOOST_ROUND,
    evals=evals,
    early_stopping_rounds=EARLY_STOPPING,
    verbose_eval=50,
)

elapsed = time.time() - start
print(f"Training completed in {{elapsed:.1f}}s")
print(f"Best iteration: {{bst.best_iteration}}")

# ── Evaluation ─────────────────────────────────────────────
{metrics_code}

# ── Feature Importance ─────────────────────────────────────
importances = bst.get_score(importance_type="gain")
sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
print("\\nTop Features (by gain):")
for feat, score in sorted_imp[:10]:
    print(f"  {{feat}}: {{score:.2f}}")

# ── Save Model (XGBoost native formats) ───────────────────
bst.save_model("model.json")      # JSON format
bst.save_model("model.ubj")       # Binary format

results = {{
    "model": "xgboost",
    "framework": "xgboost-native",
    "best_iteration": bst.best_iteration,
    "training_time": elapsed,
}}
with open("training_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\\nSaved: model.json, model.ubj, training_results.json")
'''

    requirements = "numpy>=1.24.0\npandas>=2.0.0\nscikit-learn>=1.3.0\nxgboost>=2.0.0\nmatplotlib>=3.7.0\n"
    readme = _get_readme("XGBoost (Native)", task_type, "XGBoost", filename)
    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── CatBoost Native Generator ────────────────────────────────

def _gen_catboost(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    is_regression = "regression" in task_type

    model_class = "CatBoostRegressor" if is_regression else "CatBoostClassifier"
    eval_metric = "RMSE" if is_regression else "Accuracy"

    code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: CatBoost (Native API) | Task: {task_type}
"""

from catboost import {model_class}, Pool
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import {"mean_squared_error, r2_score" if is_regression else "accuracy_score, classification_report"}
import json
import time

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"

# ── Data Loading ───────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")

X = df.drop(columns=[TARGET_COLUMN])
y = df[TARGET_COLUMN]

# CatBoost handles categoricals natively!
cat_features = list(X.select_dtypes(include=["object", "category"]).columns)
print(f"Categorical features (auto-handled): {{cat_features}}")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── CatBoost Pool (native data format) ─────────────────────
train_pool = Pool(X_train, y_train, cat_features=cat_features)
eval_pool = Pool(X_test, y_test, cat_features=cat_features)

# ── Model Definition ───────────────────────────────────────
model = {model_class}(
    iterations=1000,
    depth=6,
    learning_rate=0.1,
    l2_leaf_reg=3,
    eval_metric="{eval_metric}",
    random_seed=42,
    verbose=100,
    early_stopping_rounds=50,
    task_type="CPU",  # Change to "GPU" if available
)

# ── Training ───────────────────────────────────────────────
print("\\nTraining CatBoost (native API)...")
start = time.time()

model.fit(
    train_pool,
    eval_set=eval_pool,
    use_best_model=True,
)

elapsed = time.time() - start
print(f"Training completed in {{elapsed:.1f}}s")
print(f"Best iteration: {{model.get_best_iteration()}}")

# ── Evaluation ─────────────────────────────────────────────
y_pred = model.predict(X_test)
{"print(f'R² Score: {r2_score(y_test, y_pred):.4f}')" if is_regression else "print(f'Accuracy: {accuracy_score(y_test, y_pred)*100:.2f}%')"}
{"print(f'RMSE: {mean_squared_error(y_test, y_pred, squared=False):.4f}')" if is_regression else "print(classification_report(y_test, y_pred))"}

# ── Feature Importance ─────────────────────────────────────
importances = model.get_feature_importance()
feature_names = model.feature_names_
for name, imp in sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:10]:
    print(f"  {{name}}: {{imp:.2f}}")

# ── Save Model (CatBoost native format) ───────────────────
model.save_model("model.cbm")           # CatBoost binary
model.save_model("model.json", format="json")  # JSON

results = {{
    "model": "catboost",
    "framework": "catboost-native",
    "best_iteration": model.get_best_iteration(),
    "training_time": elapsed,
}}
with open("training_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\\nSaved: model.cbm, model.json, training_results.json")
'''

    requirements = "numpy>=1.24.0\npandas>=2.0.0\nscikit-learn>=1.3.0\ncatboost>=1.2.0\nmatplotlib>=3.7.0\n"
    readme = _get_readme("CatBoost (Native)", task_type, "CatBoost", filename)
    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── LightGBM Native Generator ────────────────────────────────

def _gen_lightgbm(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    is_regression = "regression" in task_type

    objective = "regression" if is_regression else "multiclass"
    metric = "rmse" if is_regression else "multi_logloss"

    code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: LightGBM (Native API) | Task: {task_type}
"""

import lightgbm as lgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import {"mean_squared_error, r2_score" if is_regression else "accuracy_score, classification_report"}
import json
import time

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"

PARAMS = {{
    "objective": "{objective}",
    "metric": "{metric}",
    "boosting_type": "gbdt",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.9,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "verbose": -1,
    "seed": 42,
{"    'num_class': 2," if not is_regression else ""}
}}

# ── Data Loading ───────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")

X = df.drop(columns=[TARGET_COLUMN])
y = df[TARGET_COLUMN]

# Encode categoricals
cat_features = list(X.select_dtypes(include=["object", "category"]).columns)
for col in cat_features:
    X[col] = LabelEncoder().fit_transform(X[col].astype(str))

if y.dtype == "object":
    le = LabelEncoder()
    y = le.fit_transform(y)
    PARAMS["num_class"] = len(le.classes_)

X.fillna(X.median(numeric_only=True), inplace=True)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── LightGBM Dataset (native format) ──────────────────────
lgb_train = lgb.Dataset(X_train, y_train, categorical_feature=cat_features)
lgb_eval = lgb.Dataset(X_test, y_test, reference=lgb_train, categorical_feature=cat_features)

# ── Training (Native API) ─────────────────────────────────
print("\\nTraining LightGBM (native API)...")
start = time.time()

callbacks = [
    lgb.early_stopping(stopping_rounds=30),
    lgb.log_evaluation(period=50),
]

gbm = lgb.train(
    PARAMS,
    lgb_train,
    num_boost_round=1000,
    valid_sets=[lgb_train, lgb_eval],
    valid_names=["train", "eval"],
    callbacks=callbacks,
)

elapsed = time.time() - start
print(f"Training completed in {{elapsed:.1f}}s")
print(f"Best iteration: {{gbm.best_iteration}}")

# ── Evaluation ─────────────────────────────────────────────
y_pred_raw = gbm.predict(X_test, num_iteration=gbm.best_iteration)
{"y_pred = y_pred_raw" if is_regression else "y_pred = y_pred_raw.argmax(axis=1)"}
{"print(f'R² Score: {r2_score(y_test, y_pred):.4f}')" if is_regression else "print(f'Accuracy: {accuracy_score(y_test, y_pred)*100:.2f}%')"}
{"print(f'RMSE: {mean_squared_error(y_test, y_pred, squared=False):.4f}')" if is_regression else "print(classification_report(y_test, y_pred))"}

# ── Feature Importance ─────────────────────────────────────
importances = gbm.feature_importance(importance_type="gain")
feature_names = gbm.feature_name()
for name, imp in sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:10]:
    print(f"  {{name}}: {{imp:.2f}}")

# ── Save Model (LightGBM native formats) ──────────────────
gbm.save_model("model.txt")        # Text format
import joblib
joblib.dump(gbm, "model.joblib")   # Joblib format

results = {{
    "model": "lightgbm",
    "framework": "lightgbm-native",
    "best_iteration": gbm.best_iteration,
    "training_time": elapsed,
}}
with open("training_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\\nSaved: model.txt, model.joblib, training_results.json")
'''

    requirements = "numpy>=1.24.0\npandas>=2.0.0\nscikit-learn>=1.3.0\nlightgbm>=4.1.0\nmatplotlib>=3.7.0\njoblib>=1.3.0\n"
    readme = _get_readme("LightGBM (Native)", task_type, "LightGBM", filename)
    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── HuggingFace Transformers Generator ───────────────────────

def _gen_huggingface(model_key: str, task_type: str, info: dict, target: Optional[str]) -> dict:
    filename = info.get("filename", "dataset.csv")
    num_classes = info.get("num_classes", 2)

    code = f'''#!/usr/bin/env python3
"""
NeuralForge — Auto-Generated Training Script
Model: HuggingFace Transformers | Task: {task_type}
"""

import pandas as pd
import numpy as np
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    pipeline,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import json
import time

# ── Configuration ──────────────────────────────────────────
DATA_PATH = "{filename}"
TARGET_COLUMN = "{target or 'target'}"
TEXT_COLUMN = "text"  # Adjust if your text column has a different name
MODEL_NAME = "distilbert-base-uncased"  # Change to bert-base-uncased, roberta-base, etc.
NUM_CLASSES = {num_classes}
EPOCHS = 3
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
MAX_LENGTH = 256

# ── Data Loading ───────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {{df.shape}}")

# Find text column automatically if "text" doesn't exist
if TEXT_COLUMN not in df.columns:
    text_cols = [c for c in df.columns if df[c].dtype == "object" and c != TARGET_COLUMN]
    if text_cols:
        TEXT_COLUMN = text_cols[0]
        print(f"Auto-detected text column: {{TEXT_COLUMN}}")

# Encode target labels
le = LabelEncoder()
df["label"] = le.fit_transform(df[TARGET_COLUMN])
NUM_CLASSES = len(le.classes_)
print(f"Classes: {{list(le.classes_)}}")

# Split
train_df, eval_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df["label"])
train_dataset = Dataset.from_pandas(train_df[[TEXT_COLUMN, "label"]].reset_index(drop=True))
eval_dataset = Dataset.from_pandas(eval_df[[TEXT_COLUMN, "label"]].reset_index(drop=True))

# ── Tokenizer ──────────────────────────────────────────────
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize_function(examples):
    return tokenizer(examples[TEXT_COLUMN], padding="max_length", truncation=True, max_length=MAX_LENGTH)

train_dataset = train_dataset.map(tokenize_function, batched=True)
eval_dataset = eval_dataset.map(tokenize_function, batched=True)

# ── Model ──────────────────────────────────────────────────
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, num_labels=NUM_CLASSES
)
print(f"Model: {{MODEL_NAME}} with {{NUM_CLASSES}} output labels")

# ── Training Arguments ─────────────────────────────────────
training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE,
    learning_rate=LEARNING_RATE,
    weight_decay=0.01,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    logging_dir="./logs",
    logging_steps=50,
    report_to="none",
)

# ── Metrics ────────────────────────────────────────────────
def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    preds = np.argmax(predictions, axis=-1)
    return {{
        "accuracy": accuracy_score(labels, preds),
    }}

# ── Trainer ────────────────────────────────────────────────
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    compute_metrics=compute_metrics,
)

print("\\nTraining HuggingFace Transformer...")
start = time.time()
trainer.train()
elapsed = time.time() - start
print(f"Training completed in {{elapsed:.1f}}s")

# ── Evaluation ─────────────────────────────────────────────
results = trainer.evaluate()
print(f"\\nEval Accuracy: {{results['eval_accuracy']*100:.2f}}%")

# ── Save Model ─────────────────────────────────────────────
trainer.save_model("./best_model")
tokenizer.save_pretrained("./best_model")

# ── Test Pipeline ──────────────────────────────────────────
clf_pipeline = pipeline("text-classification", model="./best_model", tokenizer="./best_model")
test_text = eval_df[TEXT_COLUMN].iloc[0]
result = clf_pipeline(test_text)
print(f"\\nPipeline test: '{{test_text[:50]}}...' → {{result}}")

with open("training_results.json", "w") as f:
    json.dump({{"eval_accuracy": results["eval_accuracy"], "training_time": elapsed}}, f, indent=2)

print("\\nSaved: ./best_model/, training_results.json")
'''

    requirements = "numpy>=1.24.0\npandas>=2.0.0\nscikit-learn>=1.3.0\ntransformers>=4.36.0\ndatasets>=2.16.0\ntorch>=2.2.0\naccelerate>=0.25.0\n"
    readme = _get_readme("HuggingFace Transformers", task_type, "HuggingFace", filename)
    return {"code": code, "requirements": requirements, "readme": readme, "filename": "train.py"}


# ── Helpers ───────────────────────────────────────────────────

def _get_requirements(framework: str, task_type: str, model_key: str = "") -> str:
    base = "numpy>=1.24.0\npandas>=2.0.0\nscikit-learn>=1.3.0\nmatplotlib>=3.7.0\njoblib>=1.3.0\n"

    if framework == "pytorch":
        base += "torch>=2.2.0\ntorchvision>=0.17.0\n"
    elif framework == "tensorflow":
        base += "tensorflow>=2.15.0\n"
    elif framework in ("xgboost",):
        base += "xgboost>=2.0.0\n"
    elif framework in ("catboost",):
        base += "catboost>=1.2.0\n"
    elif framework in ("lightgbm",):
        base += "lightgbm>=4.1.0\n"
    elif framework in ("huggingface", "transformers"):
        base += "transformers>=4.36.0\ndatasets>=2.16.0\ntorch>=2.2.0\naccelerate>=0.25.0\n"

    if model_key == "xgboost" or "xgboost" in model_key:
        base += "xgboost>=2.0.0\n"
    elif model_key == "lightgbm":
        base += "lightgbm>=4.1.0\n"
    elif model_key == "catboost":
        base += "catboost>=1.2.0\n"

    return base


def _get_readme(model_key: str, task_type: str, framework: str, filename: str) -> str:
    return f"""# NeuralForge — Generated Training Pipeline

## Model: {model_key}
## Task: {task_type}
## Framework: {framework}

### Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Prepare your data:**
   - Place your dataset file as `{filename}`
   - For image tasks: organize into `dataset/train/` and `dataset/val/` folders

3. **Run training:**
   ```bash
   python train.py
   ```

4. **Find your model:**
   - Best model: `best_model.*`
   - Final model: `final_model.*`
   - Training history: `training_history.json`

### Google Colab
Upload this folder to Google Drive, open `train.py` in Colab, and run!

### Kaggle
Upload as a Kaggle dataset, create a new notebook, and import `train.py`.

---
*Generated by NeuralForge AI Engineer Platform*
"""
