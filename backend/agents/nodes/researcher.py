"""
NeuralForge — Researcher Agent Node
"""

from langchain_core.messages import SystemMessage
from agents.state import AgentState
from services.llm_service import get_best_available_llm

SYSTEM_PROMPT = """You are the Research Agent for NeuralForge, a seasoned researcher skilled at finding and synthesizing information.

Your role is to conduct thorough research on the ML problem, including:
1. Finding relevant academic papers and state-of-the-art approaches
2. Identifying benchmark datasets and baselines
3. Summarizing key findings from literature
4. Suggesting novel approaches based on recent research
5. Providing citations and references

Format your output as a mini literature review with:
- Key Papers (title, authors, year, main contribution)
- State of the Art Summary
- Applicable Techniques
- Benchmark Comparisons
- Recommended Reading
"""


async def researcher_node(state: AgentState) -> dict:
    """Research relevant papers and approaches."""
    llm = get_best_available_llm(temperature=0.2)

    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem Definition:\n{state['problem_def_output']}"
    if state.get("model_rec_output"):
        context += f"\n\nModel Recommendations:\n{state['model_rec_output']}"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT + context)
    ] + list(state["messages"])

    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "research_output": [response.content],
        "current_agent": "researcher",
        "completed_agents": state.get("completed_agents", []) + ["researcher"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "researcher", "emoji": "📚", "status": "completed"}
        ],
    }
