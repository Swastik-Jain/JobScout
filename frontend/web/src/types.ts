// ─── Shared Type Definitions ─────────────────────────────────────────────────
// Defined here (not inside AuthContext) to avoid Vite HMR circular-ref issues.

export interface ExperienceEntry {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
  tech_stack: string[];
  live_url?: string;
  repo_url?: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface GithubRepo {
  url: string;
  name?: string;
  description?: string;
  tech?: string[];
  stars?: number;
  complexity_score?: number;
  agent_comment?: string;
  verified?: boolean;
}

export interface UserProfile {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  headline?: string;
  github_url?: string;
  linkedin_url?: string;
  skills: string[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  github_repos: GithubRepo[];
  created_at?: string;
  updated_at?: string;
}
