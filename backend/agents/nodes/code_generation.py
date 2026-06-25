"""
NeuralForge — Code Generation Agent Node
"""

from langchain_core.messages import SystemMessage
from agents.state import AgentState
from services.llm_service import get_best_available_llm

SYSTEM_PROMPT = """You are the Code Generation Agent for NeuralForge, a code wizard able to generate production-ready ML code.

Based on the problem definition, data assessment, model recommendations, and research findings, generate complete Python code.

You must generate:
1. Package imports
2. Data loading and preprocessing pipeline
3. Feature engineering
4. Model definition and architecture
5. Training loop with proper logging
6. Evaluation with multiple metrics
7. Model saving/export
8. Basic inference pipeline

Code standards:
- Use type hints
- Add docstrings and comments
- Follow PEP 8
- Include error handling
- Make configurable with parameters
- Support scikit-learn, PyTorch, or TensorFlow as appropriate

Output clean, runnable Python code wrapped in ```python code blocks.
"""


async def code_generation_node(state: AgentState) -> dict:
    """Generate ML code based on accumulated context."""
    llm = get_best_available_llm(temperature=0.1)

    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem Definition:\n{state['problem_def_output']}"
    if state.get("model_rec_output"):
        context += f"\n\nModel Recommendations:\n{state['model_rec_output']}"
    if state.get("research_output"):
        context += f"\n\nResearch Results:\n{state['research_output']}"
    if state.get("feature_eng_output"):
        context += f"\n\nFeature Engineering:\n{state['feature_eng_output']}"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT + context)
    ] + list(state["messages"])

    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "code_gen_output": response.content,
        "current_agent": "code_generation",
        "completed_agents": state.get("completed_agents", []) + ["code_generation"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "code_generation", "emoji": "💻", "status": "completed"}
        ],
    }
