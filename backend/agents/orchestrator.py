"""
NeuralForge — Agent Orchestrator
LangGraph StateGraph that routes between specialized agents.
Implements intent detection, agent routing, and multi-step workflows.
"""

import logging
from typing import AsyncGenerator, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from agents.state import AgentState
from agents.nodes.problem_definition import problem_definition_node
from agents.nodes.dataset_assessment import dataset_assessment_node
from agents.nodes.model_recommendation import model_recommendation_node
from agents.nodes.researcher import researcher_node
from agents.nodes.code_generation import code_generation_node
from agents.nodes.specialized import (
    feature_engineering_node,
    experiment_planning_node,
    mlops_node,
    deployment_node,
    evaluation_node,
)
from services.llm_service import get_best_available_llm

logger = logging.getLogger("neuralforge.orchestrator")

# ============================================================
# Router — determines which agent(s) to invoke
# ============================================================

ROUTER_PROMPT = """You are the NeuralForge routing system. Analyze the user's message and determine which specialized agent should handle it.

Available agents:
- problem_definition: For defining ML problems, clarifying objectives, identifying problem types
- dataset_assessment: For data quality, statistics, preprocessing, EDA
- model_recommendation: For suggesting ML models, comparing architectures
- researcher: For finding papers, literature reviews, state-of-the-art
- code_generation: For generating Python ML code, pipelines, scripts
- feature_engineering: For feature selection, creation, transformation
- experiment_planning: For experiment design, hyperparameter search, cross-validation
- mlops: For ML pipelines, CI/CD, monitoring, model registry
- deployment: For containerization, model serving, cloud deployment
- evaluation: For model evaluation, metrics, bias detection, summarization
- general: For general conversation, greetings, clarifications

Respond with ONLY the agent name (one of the above). If the query is complex and needs multiple agents, respond with the FIRST agent that should handle it.

If the user is asking a general question about ML or having a casual conversation, respond with "general".
"""


async def route_to_agent(state: AgentState) -> str:
    """Determine which agent should handle the current message."""
    llm = get_best_available_llm(temperature=0.0)

    user_query = state.get("user_query", "")

    response = await llm.ainvoke([
        SystemMessage(content=ROUTER_PROMPT),
        HumanMessage(content=f"Route this message: {user_query}"),
    ])

    agent_name = response.content.strip().lower().replace(" ", "_")

    # Validate agent name
    valid_agents = [
        "problem_definition", "dataset_assessment", "model_recommendation",
        "researcher", "code_generation", "feature_engineering",
        "experiment_planning", "mlops", "deployment", "evaluation", "general"
    ]

    if agent_name not in valid_agents:
        agent_name = "general"

    logger.info(f"Routing to agent: {agent_name}")
    return agent_name


async def general_node(state: AgentState) -> dict:
    """Handle general conversation and ML questions."""
    llm = get_best_available_llm(temperature=0.3)

    system_msg = """You are NeuralForge, an AI ML consultant platform. You help professionals with machine learning projects.

You have access to specialized agents for problem definition, dataset assessment, model recommendations, research, code generation, feature engineering, experiment planning, MLOps, deployment, and evaluation.

For general questions, provide helpful, knowledgeable responses. If the user's question would benefit from a specialized agent, mention which agent could help them further.

Be conversational, professional, and helpful. Use markdown formatting for structured responses."""

    messages = [SystemMessage(content=system_msg)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "current_agent": "general",
        "completed_agents": state.get("completed_agents", []) + ["general"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "general", "emoji": "🧠", "status": "completed"}
        ],
    }


# ============================================================
# Build the graph
# ============================================================

def build_agent_graph() -> StateGraph:
    """Build the LangGraph agent orchestration graph."""
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("router", lambda state: state)  # Pass-through for routing
    workflow.add_node("general", general_node)
    workflow.add_node("problem_definition", problem_definition_node)
    workflow.add_node("dataset_assessment", dataset_assessment_node)
    workflow.add_node("model_recommendation", model_recommendation_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("code_generation", code_generation_node)
    workflow.add_node("feature_engineering", feature_engineering_node)
    workflow.add_node("experiment_planning", experiment_planning_node)
    workflow.add_node("mlops", mlops_node)
    workflow.add_node("deployment", deployment_node)
    workflow.add_node("evaluation", evaluation_node)

    # Entry point
    workflow.set_entry_point("router")

    # Conditional routing from router
    workflow.add_conditional_edges(
        "router",
        route_to_agent,
        {
            "general": "general",
            "problem_definition": "problem_definition",
            "dataset_assessment": "dataset_assessment",
            "model_recommendation": "model_recommendation",
            "researcher": "researcher",
            "code_generation": "code_generation",
            "feature_engineering": "feature_engineering",
            "experiment_planning": "experiment_planning",
            "mlops": "mlops",
            "deployment": "deployment",
            "evaluation": "evaluation",
        },
    )

    # All agents terminate after completion (single-step for now)
    for node_name in [
        "general", "problem_definition", "dataset_assessment",
        "model_recommendation", "researcher", "code_generation",
        "feature_engineering", "experiment_planning", "mlops",
        "deployment", "evaluation",
    ]:
        workflow.add_edge(node_name, END)

    return workflow


# Compile the graph
agent_graph = build_agent_graph().compile()


# ============================================================
# Main entry point for chat API
# ============================================================

async def run_agent_workflow(
    message: str,
    project_id: str,
    conversation_history: list[dict] = None,
    agent_mode: str = "auto",
    model: str = None,
) -> AsyncGenerator[dict, None]:
    """
    Run the agent workflow and yield streaming events.

    Args:
        message: User's message
        project_id: Project ID for context
        conversation_history: Previous messages
        agent_mode: "auto" for routing, or specific agent name
        model: Optional NVIDIA model name to use

    Yields:
        dict events: {"type": "token"|"agent_start"|"agent_end"|"done", ...}
    """
    # Build initial state
    messages = []
    if conversation_history:
        for msg in conversation_history[-10:]:  # Last 10 messages for context
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))

    # Add current message
    messages.append(HumanMessage(content=message))

    initial_state: AgentState = {
        "messages": messages,
        "current_agent": None,
        "next_agent": None,
        "project_id": project_id,
        "user_query": message,
        "problem_def_output": None,
        "dataset_info_output": None,
        "research_output": None,
        "model_rec_output": None,
        "feature_eng_output": None,
        "experiment_output": None,
        "code_gen_output": None,
        "eval_output": None,
        "deploy_output": None,
        "mlops_output": None,
        "completed_agents": [],
        "agent_flow": [],
    }

    try:
        # Notify about routing
        yield {"type": "agent_start", "agent": "Router", "step": "Analyzing your request..."}

        # Run the graph
        result = await agent_graph.ainvoke(initial_state)

        # Extract the last AI message
        if result.get("messages"):
            last_msg = result["messages"][-1]
            content = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

            # Report which agent handled it
            agent_flow = result.get("agent_flow", [])
            if agent_flow:
                for af in agent_flow:
                    yield {
                        "type": "agent_start",
                        "agent": af.get("agent", "unknown"),
                        "step": f"{af.get('emoji', '🤖')} Processing...",
                    }
                    yield {"type": "agent_end", "agent": af.get("agent")}

            # Stream the response token by token (simulate streaming for non-streaming models)
            chunk_size = 20
            for i in range(0, len(content), chunk_size):
                yield {"type": "token", "content": content[i:i + chunk_size]}

        yield {"type": "done"}

    except Exception as e:
        logger.error(f"Agent workflow error: {e}", exc_info=True)
        yield {"type": "token", "content": f"I encountered an error while processing your request: {str(e)}. Please check your LLM API keys are configured correctly."}
        yield {"type": "done"}
