"""
Hand-Labeled Matcher Evaluation Benchmark Dataset
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
30 curated and annotated (candidate_profile, job_posting) pairs across
6 diverse industry domains and seniority tiers.

Each pair contains:
  - candidate: target_role, skills, seniority_level, preferred_location, experience, projects
  - job: id, title, company, location, description, ats
  - ground_truth_relevant: True if job is an appropriate, valid match; False if mismatch
  - ground_truth_reason: Clear architectural justification for the label
"""

BENCHMARK_QUERIES = [
    # ── QUERY 1: Entry-Level / Fresher Backend Developer ────────────────────────
    {
        "query_id": "q1_fresher_backend",
        "candidate": {
            "name": "Arjun Sharma",
            "target_role": "Backend Developer",
            "skills": ["Python", "FastAPI", "SQL", "PostgreSQL", "Docker", "Git"],
            "seniority_level": "Entry-Level / Fresher",
            "preferred_location": "India, Remote",
            "experience": [],
            "projects": [
                {"name": "FastAPI Store", "tech": "Python, FastAPI, PostgreSQL", "description": "REST API with JWT authentication and PostgreSQL pooling."}
            ],
        },
        "candidate_jobs": [
            {
                "id": 101,
                "title": "Junior Python Developer",
                "company": "Canonical",
                "location": "Remote, Worldwide",
                "ats": "greenhouse",
                "description": "Looking for a junior software engineer to build Python backend microservices and REST APIs. Familiarity with Git and Linux expected.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Direct role match (Python junior backend) and worldwide remote location.",
            },
            {
                "id": 102,
                "title": "Staff Infrastructure Architect",
                "company": "Stripe",
                "location": "San Francisco, CA (Onsite)",
                "ats": "greenhouse",
                "description": "Lead multi-region datacenter reliability initiatives. Requires 10+ years of distributed systems engineering and staff-level leadership.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Severe mismatch: Seniority (Staff, 10+ yrs) and strict US onsite location for an entry-level candidate.",
            },
            {
                "id": 103,
                "title": "Software Development Engineer 1 - Backend",
                "company": "HackerRank",
                "location": "Bengaluru, India",
                "ats": "greenhouse",
                "description": "Seeking SDE-1 backend engineer proficient in Python or Java to build high-scale evaluation platforms. SQL and data structures required.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "SDE-1 role in Bengaluru matching candidate's Python and SQL stack.",
            },
            {
                "id": 104,
                "title": "Senior Frontend Architect",
                "company": "Netflix",
                "location": "Los Gatos, CA (Onsite)",
                "ats": "greenhouse",
                "description": "Architect next-generation TV UI rendering engines with WebGL and React. Requires 8+ years frontend experience.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Domain mismatch (Frontend vs Backend), Seniority mismatch (Senior/Architect), and US onsite.",
            },
            {
                "id": 105,
                "title": "Associate Backend Engineer",
                "company": "Razorpay",
                "location": "Bengaluru, India (Hybrid)",
                "ats": "lever",
                "description": "Join our payments checkout team as an associate backend developer. Experience building RESTful APIs in Python or Golang with relational databases.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Associate entry-level title matching Python/REST APIs in Bengaluru.",
            },
        ],
    },

    # ── QUERY 2: Mid-Level Frontend Engineer ────────────────────────────────────
    {
        "query_id": "q2_mid_frontend",
        "candidate": {
            "name": "Priya Patel",
            "target_role": "Frontend Engineer",
            "skills": ["React", "TypeScript", "Next.js", "Tailwind CSS", "Redux", "GraphQL"],
            "seniority_level": "Mid-Level",
            "preferred_location": "India, Remote",
            "experience": [
                {"title": "Frontend Developer", "company": "TechCorp India", "duration": "2.5 years", "description": "Built responsive React dashboards and migrated codebase to TypeScript."}
            ],
            "projects": [
                {"name": "E-Commerce App", "tech": "React, Next.js, TypeScript", "description": "Full-featured shopping platform with SSR and responsive UI."}
            ],
        },
        "candidate_jobs": [
            {
                "id": 201,
                "title": "Frontend Engineer, Core UI",
                "company": "Vercel",
                "location": "Remote, Global",
                "ats": "greenhouse",
                "description": "We are seeking a Frontend Engineer proficient in React, Next.js, and TypeScript to elevate our cloud deployment interface. Remote position.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Direct tech stack match (React, Next.js, TypeScript) and global remote location.",
            },
            {
                "id": 202,
                "title": "Lead DevOps & Platform Engineer",
                "company": "Palantir",
                "location": "London, UK (Onsite)",
                "ats": "lever",
                "description": "Lead production infrastructure deployments with Terraform, Kubernetes, and bare-metal networking in secure London facilities.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Domain mismatch (DevOps vs Frontend) and UK onsite location.",
            },
            {
                "id": 203,
                "title": "Software Engineer - Frontend",
                "company": "Swiggy",
                "location": "Bengaluru, India",
                "ats": "greenhouse",
                "description": "Develop consumer-facing web experiences using React and TypeScript. 2-4 years frontend engineering experience required.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Exact seniority, location (Bengaluru), and skill match (React/TypeScript).",
            },
            {
                "id": 204,
                "title": "Senior Machine Learning Scientist",
                "company": "Uber",
                "location": "Sunnyvale, CA (Onsite)",
                "ats": "greenhouse",
                "description": "Ph.D. or MS required with publications in NeurIPS/ICML. Train large-scale reinforcement learning models for ride dispatch.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Total domain mismatch (ML science vs Frontend) and senior US role.",
            },
            {
                "id": 205,
                "title": "UI Engineer",
                "company": "Postman",
                "location": "Bengaluru / Remote",
                "ats": "ashby",
                "description": "Build high-performance web and desktop UI components using modern React, TypeScript, and CSS-in-JS.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Strong skill and domain alignment (React/TypeScript/UI) in Bengaluru/Remote.",
            },
        ],
    },

    # ── QUERY 3: Machine Learning & Data Engineer ───────────────────────────────
    {
        "query_id": "q3_ml_engineer",
        "candidate": {
            "name": "Vikram Sen",
            "target_role": "Machine Learning Engineer",
            "skills": ["Python", "PyTorch", "Pandas", "Scikit-Learn", "SQL", "Docker", "MLOps"],
            "seniority_level": "Mid-Level",
            "preferred_location": "Remote",
            "experience": [
                {"title": "ML Engineer", "company": "DataSynth Labs", "duration": "2 years", "description": "Trained and deployed NLP classification models into production containers."}
            ],
            "projects": [
                {"name": "DocSearch NLP", "tech": "Python, PyTorch, Transformers", "description": "Vector similarity search engine for enterprise document retrieval."}
            ],
        },
        "candidate_jobs": [
            {
                "id": 301,
                "title": "Machine Learning Engineer - NLP & Systems",
                "company": "Scale AI",
                "location": "Remote, Global",
                "ats": "greenhouse",
                "description": "Build automated evaluation pipelines for LLM fine-tuning. Requires solid Python, PyTorch, and containerized deployment experience.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Exact match for PyTorch/Python/NLP MLOps in a global remote role.",
            },
            {
                "id": 302,
                "title": "Linux Kernel Driver Engineer",
                "company": "Canonical",
                "location": "Remote",
                "ats": "greenhouse",
                "description": "Maintain low-level Linux kernel hardware drivers in C. Requires deep understanding of memory management and x86_64 architecture.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Low-level C/Kernel driver domain is completely unrelated to ML engineering.",
            },
            {
                "id": 303,
                "title": "Data / ML Systems Engineer",
                "company": "Hugging Face",
                "location": "Remote",
                "ats": "ashby",
                "description": "Help scale our open-source datasets and training pipelines using Python, PyTorch, and distributed clusters.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Direct overlap with candidate's open-source ML stack (Python/PyTorch/Data).",
            },
            {
                "id": 304,
                "title": "VP of Global Enterprise Sales",
                "company": "Databricks",
                "location": "New York, NY (Onsite)",
                "ats": "greenhouse",
                "description": "Lead enterprise quota-carrying account executive teams across North America. Requires 15+ years B2B software sales management.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Executive sales management role; zero technical engineering overlap.",
            },
            {
                "id": 305,
                "title": "Applied AI Researcher / Engineer",
                "company": "Cohere",
                "location": "Remote",
                "ats": "greenhouse",
                "description": "Implement and benchmark state-of-the-art transformer architectures in PyTorch. Good foundations in Python and model evaluation.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Strong match for applied NLP/PyTorch candidate in a remote setting.",
            },
        ],
    },

    # ── QUERY 4: DevOps & Cloud Platform Engineer ───────────────────────────────
    {
        "query_id": "q4_devops_engineer",
        "candidate": {
            "name": "Kavita Reddy",
            "target_role": "DevOps Engineer",
            "skills": ["Docker", "Kubernetes", "AWS", "Terraform", "CI/CD", "Linux", "Bash"],
            "seniority_level": "Mid-Level",
            "preferred_location": "India, Remote",
            "experience": [
                {"title": "Cloud Operations Engineer", "company": "CloudScape", "duration": "3 years", "description": "Managed EKS clusters, automated Terraform infrastructure, and GitHub Actions CI/CD."}
            ],
            "projects": [
                {"name": "GitOps K8s Cluster", "tech": "Kubernetes, Terraform, ArgoCD", "description": "Automated declarative cluster deployment pipeline."}
            ],
        },
        "candidate_jobs": [
            {
                "id": 401,
                "title": "Infrastructure Engineer - Kubernetes",
                "company": "GitLab",
                "location": "Remote, Worldwide",
                "ats": "greenhouse",
                "description": "Help manage and automate multi-tenant Kubernetes clusters on AWS/GCP using Terraform and Helm. Fully remote company.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Exact match for Kubernetes, AWS, Terraform, and Remote location.",
            },
            {
                "id": 402,
                "title": "Native iOS Mobile Developer",
                "company": "Zepto",
                "location": "Mumbai, India (Onsite)",
                "ats": "lever",
                "description": "Build high-performance swift consumer app flows for 10-minute grocery delivery. Requires Swift, UIKit, and CoreData expertise.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Complete domain mismatch (iOS/Swift app vs Cloud DevOps infrastructure).",
            },
            {
                "id": 403,
                "title": "DevOps Engineer - Cloud Operations",
                "company": "BrowserStack",
                "location": "Bengaluru / Mumbai, India",
                "ats": "greenhouse",
                "description": "Manage 24/7 cloud testing grid on AWS. Proficiency in Linux, Docker, Kubernetes, and automated monitoring pipelines required.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Target role match (DevOps) in India with AWS and Docker skills.",
            },
            {
                "id": 404,
                "title": "Managing Director, Quantitative Trading",
                "company": "Goldman Sachs",
                "location": "New York, NY",
                "ats": "greenhouse",
                "description": "Head quantitative market-making strategies. Requires advanced mathematical finance background and FINRA Series 7/24.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Financial trading executive role with regulatory certification requirements.",
            },
            {
                "id": 405,
                "title": "Cloud Platform Engineer",
                "company": "HashiCorp",
                "location": "Remote, Global",
                "ats": "greenhouse",
                "description": "Build and maintain cloud infrastructure tooling for Terraform Cloud. Strong skills in Linux, container runtimes, and AWS.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Strong alignment with Terraform, AWS, and Linux infrastructure skills.",
            },
        ],
    },

    # ── QUERY 5: Engineering Student / Intern ───────────────────────────────────
    {
        "query_id": "q5_intern_student",
        "candidate": {
            "name": "Rohan Gupta",
            "target_role": "Software Engineering Intern",
            "skills": ["C++", "Data Structures", "Algorithms", "Python", "Git", "Linux"],
            "seniority_level": "Intern / Entry-Level",
            "preferred_location": "India",
            "experience": [],
            "projects": [
                {"name": "Graph Shortest Path Visualizer", "tech": "C++, Raylib", "description": "Interactive visualizer for Dijkstra and A* pathfinding."}
            ],
        },
        "candidate_jobs": [
            {
                "id": 501,
                "title": "Software Engineering Intern - 2026",
                "company": "Media.net",
                "location": "Mumbai, India",
                "ats": "lever",
                "description": "6-month internship for pre-final and final year computer science students. Focus on C++, algorithms, and low-latency systems.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Ideal internship role in India matching candidate's C++ and algorithms profile.",
            },
            {
                "id": 502,
                "title": "Principal Architect, Distributed Storage",
                "company": "Meta",
                "location": "Menlo Park, CA (Onsite)",
                "ats": "greenhouse",
                "description": "Architect exabyte-scale distributed object storage systems. Requires 12+ years of distributed systems engineering and patents.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Extreme seniority mismatch (Principal, 12+ yrs) and US onsite location.",
            },
            {
                "id": 503,
                "title": "Student Researcher / Engineering Intern",
                "company": "Google",
                "location": "Bengaluru, India",
                "ats": "greenhouse",
                "description": "Internship opportunity for university students pursuing a degree in computer science. Strong fundamentals in C++, algorithms, and problem solving.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Top internship match in Bengaluru for CS student with C++ fundamentals.",
            },
            {
                "id": 504,
                "title": "Senior Director of Global Customer Support",
                "company": "Datadog",
                "location": "Paris, France",
                "ats": "greenhouse",
                "description": "Manage 150+ multilingual technical support engineers across EMEA. Requires 10+ years enterprise customer support leadership.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Director-level customer support role in France.",
            },
            {
                "id": 505,
                "title": "Software Engineer - University Graduate",
                "company": "Microsoft",
                "location": "Hyderabad, India",
                "ats": "greenhouse",
                "description": "Open to recent graduates and students graduating in 2026. Roles in Azure core services. Strong algorithmic foundations in C++ or Java.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "University graduate role in Hyderabad matching algorithms and C++ background.",
            },
        ],
    },

    # ── QUERY 6: Mobile Android Engineer ────────────────────────────────────────
    {
        "query_id": "q6_android_engineer",
        "candidate": {
            "name": "Ananya Joshi",
            "target_role": "Android Developer",
            "skills": ["Kotlin", "Android SDK", "Jetpack Compose", "Java", "Coroutines", "Retrofit"],
            "seniority_level": "Mid-Level",
            "preferred_location": "India, Remote",
            "experience": [
                {"title": "Android Developer", "company": "MobilityApps", "duration": "2.5 years", "description": "Developed modern Android consumer apps in Kotlin using Jetpack Compose and MVVM."}
            ],
            "projects": [
                {"name": "CryptoTracker Android", "tech": "Kotlin, Jetpack Compose, Retrofit", "description": "Real-time cryptocurrency tracking app with offline caching."}
            ],
        },
        "candidate_jobs": [
            {
                "id": 601,
                "title": "Software Engineer - Android",
                "company": "CRED",
                "location": "Bengaluru, India",
                "ats": "lever",
                "description": "Join our Android engineering team crafting buttery-smooth UI experiences. Deep expertise in Kotlin, Jetpack Compose, and Android architecture components.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Perfect skill match (Kotlin/Compose) and target location (Bengaluru).",
            },
            {
                "id": 602,
                "title": "Staff Data Warehouse Architect",
                "company": "Snowflake",
                "location": "Bozeman, MT (Onsite)",
                "ats": "greenhouse",
                "description": "Architect cloud data warehousing storage query optimization. Requires 10+ years in C++ database internals.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "Data warehouse internals mismatch and US onsite role.",
            },
            {
                "id": 603,
                "title": "Mobile Engineer (Android)",
                "company": "Duolingo",
                "location": "Remote, Global",
                "ats": "greenhouse",
                "description": "Build delightful language-learning app features on Android. Strong knowledge of Kotlin, coroutines, and reactive programming.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Direct role and stack match (Android/Kotlin) in a remote role.",
            },
            {
                "id": 604,
                "title": "Lead Site Reliability Engineer",
                "company": "Datadog",
                "location": "Tokyo, Japan",
                "ats": "greenhouse",
                "description": "Manage multi-cloud infrastructure and incident command. Japanese and English bilingual fluency required.",
                "ground_truth_relevant": False,
                "ground_truth_reason": "SRE domain and Tokyo location mismatch.",
            },
            {
                "id": 605,
                "title": "Software Engineer II - Android",
                "company": "PhonePe",
                "location": "Bengaluru, India",
                "ats": "greenhouse",
                "description": "Scale digital payment app experiences for 400M+ users. 2-4 years experience in Kotlin, Android SDK, and modular architecture.",
                "ground_truth_relevant": True,
                "ground_truth_reason": "Strong mid-level Android match in Bengaluru with Kotlin.",
            },
        ],
    },
]
