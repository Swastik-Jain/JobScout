"""
Orchestrator (LangGraph)
━━━━━━━━━━━━━━━━━━━━━━━━
Graph: profile_agent → resume_generator → critic → (reoptimize | END)

No OpenAI dependency — entirely driven by Gemini via ResumeAgent.
The job_finder_agent is only called from the /fetch-jobs HTTP endpoint,
NOT from this graph, to keep resume generation fast and quota-efficient.
"""

from typing import TypedDict, List, Dict, Annotated
from langgraph.graph import StateGraph, END
import operator


# ─── Shared State ─────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    user_profile: Dict
    jobs: List[Dict]
    selected_job: Dict
    resume_md: str
    ats_score: float
    improvements: List[str]
    critic_feedback: str
    status: str
    logs: Annotated[List[str], operator.add]


# ─── Nodes ────────────────────────────────────────────────────────────────────
def profile_agent(state: AgentState):
    profile = state["user_profile"]
    if not profile.get("skills"):
        return {
            "status": "error",
            "logs": ["ProfileAgent: Skills missing — proceeding with best-effort resume."],
        }
    return {
        "status": "profile_validated",
        "logs": [f"ProfileAgent: Profile validated for {profile.get('name', 'candidate')}."],
    }


def resume_agent_node(state: AgentState):
    from app.agents.resume_agent import ResumeAgent

    agent = ResumeAgent()
    job = state.get("selected_job") or {}
    job_desc = job.get("description") or str(job) or "General software engineering role."
    profile = state["user_profile"]
    feedback = state.get("critic_feedback") or None

    result = agent.generate_resume(profile, job_desc, feedback)

    return {
        "resume_md": result.resume_md,
        "ats_score": result.ats_score,
        "improvements": result.improvements,
        "status": "resume_generated",
        "logs": [f"ResumeAgent: Generated resume — ATS Score: {result.ats_score}/100."],
    }


def critic_agent_node(state: AgentState):
    from app.agents.resume_agent import ResumeAgent, ResumeAgentOutput

    agent = ResumeAgent()
    output = ResumeAgentOutput(
        resume_md=state.get("resume_md", ""),
        ats_score=int(state.get("ats_score", 0)),
        improvements=state.get("improvements", []),
    )
    review = agent.critic_agent(output)

    if review["status"] == "reoptimize":
        return {
            "critic_feedback": review["feedback"],
            "status": "reoptimize",
            "logs": [f"CriticAgent: Score below threshold — requesting reoptimization."],
        }

    return {
        "status": "approved",
        "logs": [f"CriticAgent: {review['feedback']}"],
    }


# ─── Routing ──────────────────────────────────────────────────────────────────
def decide_after_critic(state: AgentState) -> str:
    # Only allow 1 reoptimize pass to conserve quota
    if state.get("status") == "reoptimize" and not state.get("critic_feedback", "").startswith("Current ATS Score is 0"):
        return "resume_generator"
    return "end"


# ─── Build Graph ──────────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)

workflow.add_node("profile", profile_agent)
workflow.add_node("resume_generator", resume_agent_node)
workflow.add_node("critic", critic_agent_node)

workflow.set_entry_point("profile")
workflow.add_edge("profile", "resume_generator")
workflow.add_edge("resume_generator", "critic")

workflow.add_conditional_edges(
    "critic",
    decide_after_critic,
    {
        "resume_generator": "resume_generator",
        "end": END,
    },
)

orchestrator = workflow.compile()
