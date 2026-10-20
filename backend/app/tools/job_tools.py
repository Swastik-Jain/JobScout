from typing import List, Dict
import random

class JobSearchTool:
    @staticmethod
    def search_jobs(query: str, platform: str) -> List[Dict]:
        """
        Mock job search results from various platforms.
        """
        job_templates = [
            {"title": f"Senior {query} Engineer", "company": "TechCorp", "location": "Remote"},
            {"title": f"{query} Developer", "company": "InnoSoft", "location": "New York, NY"},
            {"title": f"Lead {query} Architect", "company": "CloudScale", "location": "San Francisco, CA"},
            {"title": f"Junior {query} Analyst", "company": "DataFlow", "location": "Austin, TX"},
        ]
        
        results = []
        for i in range(2): # 2 results per platform
            template = random.choice(job_templates)
            results.append({
                "title": template["title"],
                "company": template["company"],
                "description": f"Exciting opportunity for a {template['title']} at {template['company']}. Requires strong skills in {query}.",
                "platform": platform,
                "location": template["location"],
                "match_score": round(random.uniform(0.7, 0.95), 2)
            })
        return results

    @classmethod
    def get_all_jobs(cls, query: str) -> List[Dict]:
        platforms = ["LinkedIn", "Naukri", "Indeed", "Glassdoor"]
        all_jobs = []
        for platform in platforms:
            all_jobs.extend(cls.search_jobs(query, platform))
        return all_jobs

class ApplyTool:
    @staticmethod
    def submit_application(job_id: int, resume_md: str) -> Dict:
        """
        Mock application submission.
        """
        return {
            "status": "success",
            "message": f"Application for Job ID {job_id} submitted successfully.",
            "application_id": random.randint(1000, 9999)
        }
