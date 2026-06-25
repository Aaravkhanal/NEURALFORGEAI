"""
NeuralForge — Agents API Routes
Agent listing, status checking, and workflow execution.
"""

from fastapi import APIRouter, Depends
from core.security import get_current_user_id
from schemas import AgentInfo

router = APIRouter(prefix="/api/agents", tags=["agents"])

# Agent registry
AGENTS = [
    AgentInfo(
        id="problem_definition",
        name="Problem Definition Agent",
        description="Clarifies and defines machine learning problems, identifying problem type and specific requirements.",
        emoji="🔍",
        capabilities=["problem_classification", "requirement_extraction", "scope_definition"],
    ),
    AgentInfo(
        id="dataset_assessment",
        name="Dataset Assessment Agent",
        description="Evaluates data quality, statistical relationships, and suggests preprocessing steps.",
        emoji="📊",
        capabilities=["data_quality", "statistical_analysis", "preprocessing_suggestions"],
    ),
    AgentInfo(
        id="model_recommendation",
        name="Model Recommendation Agent",
        description="Recommends suitable ML models based on problem definition and data assessment.",
        emoji="🤖",
        capabilities=["model_selection", "benchmark_comparison", "architecture_design"],
    ),
    AgentInfo(
        id="researcher",
        name="Research Agent",
        description="Searches academic papers, performs literature reviews, and synthesizes research findings.",
        emoji="📚",
        capabilities=["paper_search", "literature_review", "citation_generation"],
    ),
    AgentInfo(
        id="code_generation",
        name="Code Generation Agent",
        description="Generates production-ready ML code including data loading, training, and evaluation.",
        emoji="💻",
        capabilities=["python_code", "sklearn_pipelines", "pytorch_code", "tensorflow_code"],
    ),
    AgentInfo(
        id="feature_engineering",
        name="Feature Engineering Agent",
        description="Suggests feature transformations, selections, and engineering strategies.",
        emoji="🔧",
        capabilities=["feature_selection", "feature_creation", "dimensionality_reduction"],
    ),
    AgentInfo(
        id="experiment_planning",
        name="Experiment Planning Agent",
        description="Designs experiment plans with hyperparameter search, cross-validation, and ablation studies.",
        emoji="🧪",
        capabilities=["experiment_design", "hyperparameter_search", "ablation_studies"],
    ),
    AgentInfo(
        id="mlops",
        name="MLOps Agent",
        description="Advises on ML pipelines, monitoring, CI/CD, and production infrastructure.",
        emoji="⚙️",
        capabilities=["pipeline_design", "monitoring", "ci_cd", "model_registry"],
    ),
    AgentInfo(
        id="deployment",
        name="Deployment Strategy Agent",
        description="Recommends deployment strategies including containerization, serving, and scaling.",
        emoji="🚀",
        capabilities=["containerization", "model_serving", "scaling", "edge_deployment"],
    ),
    AgentInfo(
        id="evaluation",
        name="Model Evaluation Agent",
        description="Evaluates model performance with metrics, visualizations, and comparative analysis.",
        emoji="📈",
        capabilities=["metrics_analysis", "visualization", "comparative_analysis", "bias_detection"],
    ),
]


@router.get("", response_model=list[AgentInfo])
async def list_agents(user_id: str = Depends(get_current_user_id)):
    """List all available agents and their capabilities."""
    return AGENTS


@router.get("/{agent_id}", response_model=AgentInfo)
async def get_agent(agent_id: str, user_id: str = Depends(get_current_user_id)):
    """Get details for a specific agent."""
    for agent in AGENTS:
        if agent.id == agent_id:
            return agent
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")
