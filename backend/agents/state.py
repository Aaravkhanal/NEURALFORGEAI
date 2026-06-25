"""
NeuralForge — Agent State Definition
TypedDict state for the LangGraph agent orchestration graph.
Fields renamed to avoid collision with LangGraph node names.
"""

from typing import Annotated, Sequence, TypedDict, Optional
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """Shared state passed between all agent nodes in the graph."""

    # Core conversation
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # Current routing
    current_agent: Optional[str]
    next_agent: Optional[str]

    # Project context
    project_id: Optional[str]
    user_query: Optional[str]

    # Agent outputs accumulate as the workflow progresses
    # Renamed with _output suffix to avoid collision with LangGraph node names
    problem_def_output: Optional[str]
    dataset_info_output: Optional[dict]
    research_output: Optional[list]
    model_rec_output: Optional[list]
    feature_eng_output: Optional[str]
    experiment_output: Optional[str]
    code_gen_output: Optional[str]
    eval_output: Optional[str]
    deploy_output: Optional[str]
    mlops_output: Optional[str]

    # Workflow control
    completed_agents: list[str]
    agent_flow: list[dict]  # Track agent execution order for visualization
