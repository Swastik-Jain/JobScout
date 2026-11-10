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
  target_role?: string;
  preferred_location?: string;
  seniority_level?: string;
  github_url?: string;
  linkedin_url?: string;
  skills: string[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  github_repos: GithubRepo[];
  profile_complete: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Structured Resume Types (Step 1 Schema) ───────────────────────────────────

export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumeBasics {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  links: ResumeLink[];
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface ExperienceItem {
  role: string;
  company: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ProjectItem {
  name: string;
  tech: string[];
  url?: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  location?: string;
  start?: string;
  end: string;
  score?: string;
}

export interface ResumeData {
  basics: ResumeBasics;
  summary?: string | null;
  skills: SkillGroup[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: string[];
}

