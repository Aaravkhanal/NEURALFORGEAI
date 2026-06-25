"""
NeuralForge — Problem Definition Agent Node
"""

from langchain_core.messages import AIMessage, SystemMessage
from agents.state import AgentState
from services.llm_service import get_best_available_llm

SYSTEM_PROMPT = """You are the Problem Definition Agent for NeuralForge, an expert in understanding and defining machine learning problems.

Your goal is to extract a clear, concise problem statement from the user's input, ensuring the project starts with a solid foundation.

You must:
1. Identify the type of ML problem (classification, regression, clustering, NLP, computer vision, time series, recommendation, etc.)
2. Clarify specific requirements and constraints
3. Define success metrics and evaluation criteria
4. Identify potential challenges and considerations
5. Suggest the overall ML approach

Output a structured problem definition with:
- Problem Type
- Objective
- Input/Output Description
- Success Metrics
- Constraints
- Recommended Approach Overview
"""


async def problem_definition_node(state: AgentState) -> dict:
    """Define and clarify the ML problem from user input."""
    llm = get_best_available_llm(temperature=0.1)

    messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(state["messages"])

    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "problem_def_output": response.content,
        "current_agent": "problem_definition",
        "completed_agents": state.get("completed_agents", []) + ["problem_definition"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "problem_definition", "emoji": "🔍", "status": "completed"}
        ],
    }
