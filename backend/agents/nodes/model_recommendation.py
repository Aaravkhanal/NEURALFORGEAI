"""
NeuralForge — Model Recommendation Agent Node
"""

from langchain_core.messages import SystemMessage
from agents.state import AgentState
from services.llm_service import get_best_available_llm

SYSTEM_PROMPT = """You are the Model Recommendation Agent for NeuralForge, an expert in ML model selection.

Based on the problem definition and data assessment, recommend the most suitable machine learning models.

You must:
1. Suggest 3-5 candidate models ranked by suitability
2. Provide rationale for each recommendation
3. Compare models on key criteria (accuracy, speed, interpretability, data requirements)
4. Recommend a primary model and alternatives
5. Suggest ensemble strategies if applicable
6. Reference recent state-of-the-art approaches

For each model provide:
- Model Name & Type
- Why It Fits
- Pros & Cons
- Expected Performance
- Implementation Complexity
- Resource Requirements
"""


async def model_recommendation_node(state: AgentState) -> dict:
    """Recommend suitable ML models based on problem and data."""
    llm = get_best_available_llm(temperature=0.2)

    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem Definition:\n{state['problem_def_output']}"
    if state.get("dataset_info_output"):
        context += f"\n\nDataset Info:\n{state['dataset_info_output']}"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT + context)
    ] + list(state["messages"])

    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "model_rec_output": [response.content],
        "current_agent": "model_recommendation",
        "completed_agents": state.get("completed_agents", []) + ["model_recommendation"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "model_recommendation", "emoji": "🤖", "status": "completed"}
        ],
    }
