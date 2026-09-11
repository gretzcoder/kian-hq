export type OrgNodeType = 'DIRECTORATE' | 'DIVISION' | 'DEPARTMENT' | 'TEAM' | 'POSITION';

export interface OrgAuthoritiesConfig {
  /**
   * Can perform QC / review on task submissions
   */
  can_review_tasks?: boolean;
  /**
   * Review scope: 'ALL' | 'MATCH_LABEL' | 'MATCH_ROLE'
   */
  review_scope?: 'ALL' | 'MATCH_LABEL' | 'MATCH_ROLE';
  /**
   * Specific task labels/categories this division can review (e.g. ['design', 'creative', 'graphic'])
   */
  review_labels?: string[];
  /**
   * Allow reviewing submissions across all workspaces without workspace membership
   */
  cross_workspace?: boolean;
  /**
   * Prevent reviewing self-created submissions (integrity check)
   */
  prevent_self_review?: boolean;
  /**
   * Can manage/approve content briefs
   */
  can_manage_briefs?: boolean;
  /**
   * Can create/sign official documents
   */
  can_manage_documents?: boolean;
  /**
   * Can manage or award sparks/multipliers
   */
  can_manage_sparks?: boolean;
  /**
   * Can view and supervise all workspaces
   */
  can_view_all_workspaces?: boolean;
  /**
   * Can assign tasks across projects
   */
  can_assign_tasks?: boolean;
}

export interface OrgMemberItem {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  user_type: 'STAFF' | 'OJT' | 'EXTERNAL';
  role_title: string;
  is_lead: boolean;
  assigned_at: number;
}

export interface OrgNodeItem {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: OrgNodeType;
  description?: string | null;
  color: string;
  icon: string;
  order_index: number;
  authorities: OrgAuthoritiesConfig;
  created_at: number;
  updated_at: number;
  members: OrgMemberItem[];
  children?: OrgNodeItem[];
}
