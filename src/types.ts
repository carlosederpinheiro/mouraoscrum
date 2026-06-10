export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  sprint_id?: string;
  assignees?: string[];
  company_id?: string;
  checklists?: ChecklistItem[];
  created_at?: string;
}

export interface EnrichedTask extends Task {
  sprintTitle: string;
  macroAreaId?: string;
  projectId?: string;
  macroAreaTitle?: string;
  projectTitle?: string;
  companyName?: string;
  isPersonal?: boolean;
}

export interface Sprint {
  id: string;
  title: string;
  project_id?: string;
  start_date?: string;
  end_date?: string;
  status?: 'planejamento' | 'em_andamento' | 'concluido' | 'cancelado';
}

export interface Staff {
  id: string;
  full_name: string;
  role: string;
  job_title?: string;
  avatar_url?: string;
  email?: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  industry?: string;
  contact_person?: string;
  logo_url?: string;
}

export interface MacroArea {
  id: string;
  name: string;
  po_id?: string;
  icon?: string;
  color?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  macro_area_id: string;
  company_id?: string;
  staff_ids?: string[];
}

// Nested types for UI
export interface SprintWithTasks extends Sprint {
  tasks: Task[];
}

export interface ProjectWithSprints extends Project {
  sprints: SprintWithTasks[];
}

export interface MacroAreaWithProjects extends MacroArea {
  projects: ProjectWithSprints[];
}
