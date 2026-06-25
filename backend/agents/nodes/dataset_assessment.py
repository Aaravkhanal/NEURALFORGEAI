"""
NeuralForge — Dataset Assessment Agent Node
"""

from langchain_core.messages import AIMessage, SystemMessage
from agents.state import AgentState
from services.llm_service import get_best_available_llm

SYSTEM_PROMPT = """You are the Dataset Assessment Agent for NeuralForge, specializing in data evaluation and preprocessing.

Your task is to guide the user in preparing their dataset for machine learning, providing detailed statistical analysis.

You must:
1. Assess data quality (completeness, consistency, accuracy)
2. Analyze statistical relationships between variables
3. Identify data types and distributions
4. Detect missing values, outliers, and anomalies
5. Suggest preprocessing steps (cleaning, normalization, encoding)
6. Recommend data augmentation strategies if needed
7. Evaluate data suitability for the defined problem

Output your assessment with:
- Data Overview (shape, types, memory usage)
- Quality Assessment (missing values, duplicates, outliers)
- Statistical Summary (distributions, correlations, key statistics)
- Preprocessing Recommendations
- Feature Suitability Analysis

Use markdown tables for structured comparisons.
"""


async def dataset_assessment_node(state: AgentState) -> dict:
    """Assess dataset quality and provide preprocessing recommendations."""
    llm = get_best_available_llm(temperature=0.1)

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
        "current_agent": "dataset_assessment",
        "completed_agents": state.get("completed_agents", []) + ["dataset_assessment"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "dataset_assessment", "emoji": "📊", "status": "completed"}
        ],
    }
