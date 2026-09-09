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
	published_version: number | null;
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
	published_version: number | null;
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
	published_version: number | null;
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

export type CloneItemType = 'AGENT' | 'SKILL' | 'WORKFLOW';

export interface CloneResult {
	item_type: CloneItemType;
	id: string;
}

export interface Provenance {
	source_item_type: CloneItemType;
	source_item_id: string;
	source_name: string | null;
	source_status: DomainStatus | null;
	cloned_at: string;
}

export type MarketplaceItemType = 'AGENT' | 'SKILL' | 'WORKFLOW';

// The light shape returned by GET /api/v1/marketplace/items (a listing
// row) — no system_prompt/skill_files/steps, those are detail-only.
export interface MarketplaceListItem {
	item_type: MarketplaceItemType;
	id: string;
	owner_id: string;
	name: string | null;
	description: string | null;
	role_id: string | null;
	role_name: string | null;
	published_version: number;
	clone_count: number;
	created_at: string;
	updated_at: string;
	rating: number | null;
	rating_count: number;
}

// The full row returned as `item` by GET /api/v1/marketplace/items/:itemType/:id
// — frozen content (system_prompt/skill_files/steps) at published_version,
// not the live row.
export interface MarketplaceItemDetail {
	item_type: MarketplaceItemType;
	id: string;
	owner_id: string;
	name: string | null;
	description: string | null;
	role_id: string | null;
	role_name: string | null;
	system_prompt: string | null;
	skill_files: SkillFile[] | null;
	steps: WorkflowStep[] | null;
	published_version: number;
	clone_count: number;
	created_at: string;
	updated_at: string;
	rating: number | null;
	rating_count: number;
}

export interface MarketplaceWorkflowStep extends WorkflowStep {
	label: string;
}
