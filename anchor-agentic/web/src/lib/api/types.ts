export interface SandboxItem {
	id: string;
	title: string;
	status: 'Draft' | 'Published' | 'UnderReview' | 'Removed';
	owner_id: string;
	created_at: string;
	updated_at: string;
}

export type DomainStatus = 'Draft' | 'Published' | 'UnderReview' | 'Removed' | 'Archived' | 'Deprecated';

export interface Role {
	id: string;
	owner_id: string;
	name: string;
	description: string | null;
	status: DomainStatus;
	current_version: number;
	created_at: string;
	updated_at: string;
}

export interface Task {
	id: string;
	owner_id: string;
	role_id: string;
	name: string;
	instructions: string | null;
	status: DomainStatus;
	current_version: number;
	created_at: string;
	updated_at: string;
}

export interface Agent {
	id: string;
	owner_id: string;
	role_id: string;
	system_prompt: string | null;
	status: DomainStatus;
	current_version: number;
	created_at: string;
	updated_at: string;
}

export interface AgentTaskAssignment {
	id: string;
	task_id: string;
	tasks: { id: string; name: string; role_id: string; status: DomainStatus } | null;
}

export interface SkillFile {
	path: string;
	content: string;
}

export interface Skill {
	id: string;
	owner_id: string;
	name: string;
	description: string | null;
	skill_files: SkillFile[];
	status: DomainStatus;
	current_version: number;
	created_at: string;
	updated_at: string;
}

export interface Workflow {
	id: string;
	owner_id: string;
	name: string;
	description: string | null;
	status: DomainStatus;
	current_version: number;
	created_at: string;
	updated_at: string;
}

export type WorkflowStepType = 'TASK' | 'AGENT' | 'SKILL';

export interface WorkflowStep {
	id: string;
	workflow_id: string;
	order_index: number;
	step_type: WorkflowStepType;
	task_id: string | null;
	agent_id: string | null;
	skill_id: string | null;
	created_at: string;
}

export type LibraryItemType = 'ROLE' | 'TASK' | 'AGENT' | 'SKILL' | 'WORKFLOW';

export interface LibraryItem {
	item_type: LibraryItemType;
	id: string;
	owner_id: string;
	name: string;
	status: DomainStatus;
	current_version: number;
	created_at: string;
	updated_at: string;
}

export interface VersionSnapshot {
	id: string;
	item_type: LibraryItemType;
	item_id: string;
	version_number: number;
	snapshot_data: unknown;
	created_by: string;
	created_at: string;
}
