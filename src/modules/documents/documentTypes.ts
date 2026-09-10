export type DocumentStatusCode = 'DRAFT' | 'GENERATED' | 'SIGNED' | 'ARCHIVED';
export type TemplateStatusCode = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AssetCategory = 'FRAME' | 'LOGO' | 'SIGNATURE' | 'STAMP' | 'DECORATION';

export interface AssigneeRow {
  no?: number;
  nip?: string;
  name: string;
  role: string;
}

export interface DocumentTypeItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  numbering_format: string;
  icon: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface DocumentAssetItem {
  id: string;
  name: string;
  category: AssetCategory;
  asset_url: string;
  mime_type: string;
  width?: number;
  height?: number;
  created_by: string;
  created_at: number;
}

export interface DocumentSignatoryItem {
  id: string;
  name: string;
  position: string;
  signature_asset_id?: string | null;
  signature_url?: string | null;
  stamp_asset_id?: string | null;
  stamp_url?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface OrganizationSnapshot {
  name: string;
  address_line_1: string;
  address_line_2: string;
  phone: string;
  email: string;
  website: string;
  logo_url?: string;
}

export interface TableColumnConfig {
  key: string;
  label: string;
  widthPercent: number;
  align: 'left' | 'center' | 'right';
}

export interface FlowSectionConfig {
  id: string;
  type:
    | 'HEADER_LOGO'
    | 'TITLE_AND_NUMBER'
    | 'INTRO_TEXT'
    | 'ASSIGNEE_TABLE'
    | 'EVENT_DETAILS'
    | 'CLOSING_TEXT'
    | 'SIGNATURE_BLOCK'
    | 'TEMBUSAN_BLOCK'
    | 'FOOTER_CONTACT'
    | 'CUSTOM_PARAGRAPH'
    | 'DIVIDER';
  title?: string;
  visible: boolean;
  spacingBottomMm?: number;
  styles?: Record<string, any>;
}

export interface CustomKopTextElement {
  id: string;
  name: string; // e.g. "Alamat Perusahaan", "Website", "No Telp"
  text: string;
  x: number; // px from left
  y: number; // px from top
  width?: number; // px max-width
  fontSizePt: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '500' | '600' | '700' | '800';
  color?: string;
  align?: 'left' | 'center' | 'right';
  isItalic?: boolean;
  isUnderline?: boolean;
}

export interface SignatureStampConfig {
  align: 'left' | 'center' | 'right';
  showStamp: boolean;
  stampAssetUrl?: string; // Custom stamp image
  stampScale?: number; // default 1
  stampOffsetX?: number; // px offset from signature
  stampOffsetY?: number; // px offset
  stampOpacity?: number; // 0.1 to 1.0
  stampRotation?: number; // deg e.g. -5 to 15
  signatureAssetUrl?: string; // Custom signature graphic
  signatureScale?: number; // default 1
  signatureOffsetX?: number;
  signatureOffsetY?: number;
}

export interface KopSuratConfig {
  frameAssetUrl?: string; // Uploaded frame image (Base64 Data URI or static URL)
  frameOpacity?: number;
  kopHeightPx: number; // Offset Y where dynamic content starts (default ~210px)
  logo: {
    enabled: boolean;
    assetUrl?: string; // Custom uploaded logo or default vector
    x: number; // X offset in px (0 - 794)
    y: number; // Y offset in px (0 - 1123)
    width: number; // Width in px
    height?: number;
  };
  tagline: {
    enabled: boolean;
    text: string;
    x: number;
    y: number;
    fontSizePt: number;
    fontFamily?: string;
    fontWeight?: string;
    color: string;
  };
  titleBlock: {
    enabled: boolean;
    x: number; // X center or offset in px
    y: number; // Y offset in px
    width: number;
    align: 'left' | 'center' | 'right';
    fontFamily?: string;
    titleFontSizePt: number;
    numberFontSizePt: number;
  };
  customTexts?: CustomKopTextElement[]; // Custom added text elements (Alamat, Website, Kontak, dll.)
}

export interface TemplateLayoutConfig {
  pageSize: 'A4';
  orientation: 'portrait';
  paddingMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  frameAssetUrl?: string; // PNG Frame background
  logoAssetUrl?: string;  // Top header logo
  primaryColor?: string;
  fontFamily?: string; // 'Times New Roman' | 'Arial' | 'Helvetica' | 'Inter' | 'Georgia' | 'Montserrat' | 'Roboto'
  fontSizeBasePt?: number;
  headingFontFamily?: string;
  titleFontSizePt?: number;
  tableFontFamily?: string;
  tableFontSizePt?: number;
  kopConfig?: KopSuratConfig;
  signatureConfig?: SignatureStampConfig;
  tableColumns: TableColumnConfig[];
  flowSections: FlowSectionConfig[];
  annexThresholdRows?: number; // Rows >= threshold will be paginated as Lampiran on Page 2+
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldSchema {
  key: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'date'
    | 'time'
    | 'select'
    | 'user_picker'
    | 'event_picker'
    | 'signatory_picker'
    | 'assignee_table'
    | 'repeatable_list'
    | 'checkbox';
  required: boolean;
  placeholder?: string;
  defaultValue?: any;
  helpText?: string;
  options?: FormFieldOption[];
}

export interface DocumentTemplateItem {
  id: string;
  type_id: string;
  type_code: string;
  type_name: string;
  name: string;
  description: string | null;
  status: TemplateStatusCode;
  current_version: number;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
  updated_by_name?: string;
  created_at: number;
  updated_at: number;
  // Version details if populated
  layout_config?: TemplateLayoutConfig;
  form_schema?: FormFieldSchema[];
  default_values?: Record<string, any>;
  sample_data?: Record<string, any>;
}

export interface DocumentTemplateVersionItem {
  id: string;
  template_id: string;
  version: number;
  layout_config: TemplateLayoutConfig;
  form_schema: FormFieldSchema[];
  default_values: Record<string, any>;
  sample_data?: Record<string, any>;
  created_by: string;
  created_at: number;
}

export interface GeneratedDocumentItem {
  id: string;
  template_id: string;
  template_name?: string;
  template_version_id: string;
  template_version?: number;
  type_code: string;
  document_number: string;
  title: string;
  form_data: Record<string, any>;
  rendered_snapshot: {
    layout_config: TemplateLayoutConfig;
    organization: OrganizationSnapshot;
    signatory: {
      name: string;
      position: string;
      signature_url?: string | null;
      stamp_url?: string | null;
    };
    compiled_data: Record<string, any>;
    generated_at: number;
  };
  status: DocumentStatusCode;
  signatory_id: string | null;
  signatory_name?: string;
  created_by: string;
  created_by_name?: string;
  created_at: number;
  updated_at: number;
}
