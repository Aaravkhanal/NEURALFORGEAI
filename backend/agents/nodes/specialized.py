"""
NeuralForge — New Agent Nodes
Feature Engineering, Experiment Planning, MLOps, Deployment, Evaluation
"""

from langchain_core.messages import SystemMessage
from agents.state import AgentState
from services.llm_service import get_best_available_llm


# ============================================================
# Feature Engineering Agent
# ============================================================

FEATURE_ENGINEERING_PROMPT = """You are the Feature Engineering Agent for NeuralForge.

Suggest feature transformations, selections, and engineering strategies based on the dataset and problem.

Provide:
- Feature Selection recommendations (which features to keep/drop)
- Feature Creation ideas (interactions, polynomials, aggregations)
- Encoding strategies for categorical variables
- Scaling/normalization recommendations
- Dimensionality reduction if needed
- Domain-specific feature engineering ideas
"""


async def feature_engineering_node(state: AgentState) -> dict:
    llm = get_best_available_llm(temperature=0.2)
    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem: {state['problem_def_output']}"
    if state.get("dataset_info_output"):
        context += f"\n\nDataset: {state['dataset_info_output']}"

    messages = [SystemMessage(content=FEATURE_ENGINEERING_PROMPT + context)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "feature_eng_output": response.content,
        "current_agent": "feature_engineering",
        "completed_agents": state.get("completed_agents", []) + ["feature_engineering"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "feature_engineering", "emoji": "🔧", "status": "completed"}
        ],
    }


# ============================================================
# Experiment Planning Agent
# ============================================================

EXPERIMENT_PLANNING_PROMPT = """You are the Experiment Planning Agent for NeuralForge.

Design a comprehensive experiment plan including:
- Experiment phases and milestones
- Hyperparameter search strategy (grid, random, Bayesian)
- Cross-validation scheme
- Ablation study design
- Baseline comparisons
- Resource and time estimates
- Success criteria for each phase
"""


async def experiment_planning_node(state: AgentState) -> dict:
    llm = get_best_available_llm(temperature=0.2)
    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem: {state['problem_def_output']}"
    if state.get("model_rec_output"):
        context += f"\n\nModels: {state['model_rec_output']}"

    messages = [SystemMessage(content=EXPERIMENT_PLANNING_PROMPT + context)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "experiment_output": response.content,
        "current_agent": "experiment_planning",
        "completed_agents": state.get("completed_agents", []) + ["experiment_planning"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "experiment_planning", "emoji": "🧪", "status": "completed"}
        ],
    }


# ============================================================
# MLOps Agent
# ============================================================

MLOPS_PROMPT = """You are the MLOps Agent for NeuralForge.

Advise on ML operations including:
- ML pipeline architecture (training, validation, serving)
- Model versioning and registry
- CI/CD for ML (training pipelines, model validation)
- Monitoring and observability (data drift, model performance)
- A/B testing framework
- Feature stores
- Recommended tools (MLflow, Weights & Biases, DVC, etc.)
"""


async def mlops_node(state: AgentState) -> dict:
    llm = get_best_available_llm(temperature=0.2)
    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem: {state['problem_def_output']}"
    if state.get("code_gen_output"):
        context += f"\n\nGenerated Code:\n{state['code_gen_output'][:2000]}"

    messages = [SystemMessage(content=MLOPS_PROMPT + context)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "mlops_output": response.content,
        "current_agent": "mlops",
        "completed_agents": state.get("completed_agents", []) + ["mlops"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "mlops", "emoji": "⚙️", "status": "completed"}
        ],
    }


# ============================================================
# Deployment Strategy Agent
# ============================================================

DEPLOYMENT_PROMPT = """You are the Deployment Strategy Agent for NeuralForge.

Recommend deployment strategies including:
- Containerization (Docker, Kubernetes)
- Model serving frameworks (TorchServe, TF Serving, FastAPI, BentoML)
- Cloud deployment options (AWS SageMaker, GCP Vertex AI, Azure ML)
- Edge deployment considerations
- Scaling strategies (horizontal, vertical, auto-scaling)
- Cost optimization
- Security considerations
"""


async def deployment_node(state: AgentState) -> dict:
    llm = get_best_available_llm(temperature=0.2)
    context = ""
    if state.get("problem_def_output"):
        context += f"\n\nProblem: {state['problem_def_output']}"
    if state.get("model_rec_output"):
        context += f"\n\nModels: {state['model_rec_output']}"

    messages = [SystemMessage(content=DEPLOYMENT_PROMPT + context)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "deploy_output": response.content,
        "current_agent": "deployment",
        "completed_agents": state.get("completed_agents", []) + ["deployment"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "deployment", "emoji": "🚀", "status": "completed"}
        ],
    }


# ============================================================
# Model Evaluation Agent (evolved from Summarization Agent)
# ============================================================

EVALUATION_PROMPT = """You are the Model Evaluation Agent for NeuralForge.

Evaluate and summarize model performance:
- Recommend evaluation metrics appropriate for the problem
- Suggest visualization approaches (confusion matrix, ROC, PR curves, etc.)
- Design comparative analysis between candidate models
- Identify potential biases and fairness issues
- Provide a final executive summary of findings
- Recommend next steps

Synthesize all agent outputs into a comprehensive project summary.
"""


async def evaluation_node(state: AgentState) -> dict:
    llm = get_best_available_llm(temperature=0.1)
    context = ""
    for key in ["problem_def_output", "model_rec_output", "research_output",
                 "code_gen_output", "feature_eng_output", "experiment_output"]:
        if state.get(key):
            val = state[key]
            if isinstance(val, list):
                val = str(val)
            context += f"\n\n{key.replace('_', ' ').title()}:\n{str(val)[:1500]}"

    messages = [SystemMessage(content=EVALUATION_PROMPT + context)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "eval_output": response.content,
        "current_agent": "evaluation",
        "completed_agents": state.get("completed_agents", []) + ["evaluation"],
        "agent_flow": state.get("agent_flow", []) + [
            {"agent": "evaluation", "emoji": "📈", "status": "completed"}
        ],
    }
