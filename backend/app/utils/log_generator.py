import asyncio
import random
from typing import AsyncGenerator

async def generate_agent_logs() -> AsyncGenerator[str, None]:
    """
    Generates realistic, technical streaming strings for the frontend terminal
    in the 'Pulastya' multi-agent style.
    """
    
    # Randomized counts to make logs feel dynamic per interaction
    skills_count = random.randint(8, 18)
    projects_count = random.randint(2, 6)
    matches_count = random.randint(12, 45)
    keywords = ["Distributed Systems", "Cloud Native Architectures", "Machine Learning Pipelines", "High-Concurrency Processing"]
    selected_keyword = random.choice(keywords)
    
    # The sequential realistic log events
    logs = [
        "[System] ➔ Booting Pulastya Multi-Agent Orchestrator Pipeline...",
        "[System] ➔ Establishing secure WebSocket telemetry stream.",
        f"[ProfileAgent] ➔ Structured {skills_count} skills and {projects_count} projects.",
        "[ProfileAgent] ➔ Normalized User Profile schema definitions.",
        f"[JobFinderAgent] ➔ Found {matches_count} matches on LinkedIn; filtering for Match Score > 75%...",
        "[JobFinderAgent] ➔ Parallelizing dork scrape via Serper API across Indeed and Glassdoor.",
        "[JobFinderAgent] ➔ Groq LLaMA3 Engine: Similarity ranking computation completed.",
        "[ResumeAgent] ➔ Initializing generation and templating pipeline.",
        f"[ResumeAgent] ➔ Optimizing for '{selected_keyword}' keyword...",
        "[ResumeAgent] ➔ Injecting domain-specific vocabulary and tailoring ATS semantics.",
        "[CriticAgent] ➔ Processing strict ATS Match Score evaluation algorithm...",
        "[CriticAgent] ➔ Validation complete. Resuming Approved. (Score: 92/100)",
        "[ApplyAgent] ➔ Simulating end-to-end application... Bypassing CAPTCHA and filling dynamic form.",
        "[ApplyAgent] ➔ Application submitted successfully and confirmation intercepted.",
        "[NotificationAgent] ➔ Pushing state logs to persistence tracking database.",
        "[System] ➔ Agent lifecycle complete. Awaiting next directive."
    ]
    
    for log in logs:
        # Simulate variable processing time for realistic terminal cadence
        delay = random.uniform(0.3, 1.8)
        await asyncio.sleep(delay)
        yield log
