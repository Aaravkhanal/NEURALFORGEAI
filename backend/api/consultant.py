"""
NeuralForge — AI Consultant API
Chatbot endpoint specializing in the user's dataset and trained model.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/consultant", tags=["AI Consultant"])

class ChatRequest(BaseModel):
    message: str
    model_id: str

@router.post("/chat")
async def chat_with_consultant(request: ChatRequest):
    """
    Chat with an AI Consultant about a specific model and dataset.
    """
    message = request.message.lower()
    
    # Mocking standard consultant responses based on common queries
    if "why did" in message or "fail" in message:
        reply = "Looking at the SHAP values, this prediction likely failed because Feature A was unusually high, outweighing the typical patterns in the training data."
    elif "improve" in message or "accuracy" in message:
        reply = "To improve accuracy, consider reducing noise in Feature Y or gathering more instances where the minority class is represented."
    elif "important" in message or "factors" in message:
        reply = "The top 3 driving factors for this model are Age, Income, and Tenure. These account for 78% of the predictive power."
    else:
        reply = f"I am analyzing the model's dataset. Regarding '{request.message}', the data suggests that standard scaling was effective, and the current XGBoost model handles the non-linear relationships well."
        
    return {
        "reply": reply,
        "context_used": ["SHAP values", "Training Metrics", "Dataset Profile"]
    }
