export interface SandboxItem {
	id: string;
	title: string;
	status: 'Draft' | 'Published' | 'UnderReview' | 'Removed';
	owner_id: string;
	created_at: string;
	updated_at: string;
}
