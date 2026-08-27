export interface CertificateTemplate {
  id: string;
  name: string;
  description: string | null;
  layout_type: 'CLASSIC' | 'MODERN' | 'ELEGANT' | 'VIBRANT';
  background_color: string;
  border_style: string;
  accent_color: string;
  signatory_name: string;
  signatory_title: string;
  signatory_signature_url?: string | null;
  custom_subtext: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface UserPerformanceMetrics {
  tasks_completed: number;
  sparks_earned: number;
  badges_count: number;
  badges_list: Array<{ name: string; icon_url?: string | null }>;
  project_count: number;
  score_grade: string; // e.g. 'S' | 'A+' | 'A' | 'B'
  summary: string;
}

export interface CertificateItem {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string | null;
  user_role?: string | null;
  template_id: string;
  template_name?: string;
  template_layout?: 'CLASSIC' | 'MODERN' | 'ELEGANT' | 'VIBRANT';
  template_data?: CertificateTemplate | null;
  certificate_code: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  issue_date: number;
  performance_metrics: UserPerformanceMetrics;
  issued_by: string;
  issued_by_name?: string;
  created_at: number;
  updated_at: number;
}

export interface CertificateUserOption {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  avatar_url?: string | null;
}
