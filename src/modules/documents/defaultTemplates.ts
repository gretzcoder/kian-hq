import {
  FormFieldSchema,
  OrganizationSnapshot,
  TemplateLayoutConfig,
} from './documentTypes';

export const DEFAULT_ORGANIZATION_PROFILE: OrganizationSnapshot = {
  name: 'KIAN TROOPERS (Kreasi Inovasi Anak Nusantara)',
  address_line_1:
    'Jl. Dewi Sartika No.289, RT.4/RW.5, Cawang, Kec. Kramat jati,',
  address_line_2:
    'Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13630',
  phone: '0812-8275-0318',
  email: 'kianeo.production@gmail.com',
  website: 'www.kianorganizer.com',
  logo_url: '/kian.ico',
};

// ============================================================================
// 1. SURAT TUGAS
// ============================================================================
export const DEFAULT_SURAT_TUGAS_LAYOUT: TemplateLayoutConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  paddingMm: {
    top: 14,
    bottom: 14,
    left: 15,
    right: 15,
  },
  contentPaddingLeftPx: 56,
  contentPaddingRightPx: 56,
  fontFamily: 'Times New Roman',
  fontSizeBasePt: 10.5,
  primaryColor: '#002B7F',
  annexThresholdRows: 4, // If assignees >= 4, auto paginated as Lampiran on Page 2+
  kopConfig: {
    frameAssetUrl: '',
    frameOpacity: 1,
    kopHeightPx: 215,
    logo: {
      enabled: true,
      x: 56,
      y: 44,
      width: 220,
      height: 48,
    },
    titleBlock: {
      enabled: true,
      x: 56,
      y: 138,
      width: 682,
      align: 'center',
      titleFontSizePt: 13,
      numberFontSizePt: 10,
    },
    customTexts: [],
  },
  signatureConfig: {
    align: 'right',
    showSignature: true,
    showStamp: true,
    showQrVerification: false,
    signatureType: 'MANUAL',
    qrSize: 84,
    stampScale: 1,
    stampOffsetX: -12,
    stampOffsetY: 0,
    stampOpacity: 0.85,
    stampRotation: 0,
    signatureScale: 1,
    signatureOffsetX: 0,
    signatureOffsetY: 0,
  },
  tableColumns: [
    { key: 'no', label: 'No', widthPercent: 8, align: 'center' },
    { key: 'nip', label: 'NIP', widthPercent: 22, align: 'center' },
    { key: 'name', label: 'NAMA', widthPercent: 42, align: 'left' },
    { key: 'role', label: 'Tugas', widthPercent: 28, align: 'left' },
  ],
  flowSections: [
    { id: 'sec_intro', type: 'INTRO_TEXT', visible: true, spacingBottomMm: 4 },
    { id: 'sec_table', type: 'ASSIGNEE_TABLE', visible: true, spacingBottomMm: 6 },
    { id: 'sec_event', type: 'EVENT_DETAILS', visible: true, spacingBottomMm: 6 },
    { id: 'sec_closing', type: 'CLOSING_TEXT', visible: true, spacingBottomMm: 8 },
    { id: 'sec_sig', type: 'SIGNATURE_BLOCK', visible: true, spacingBottomMm: 6 },
    { id: 'sec_cc', type: 'TEMBUSAN_BLOCK', visible: true, spacingBottomMm: 4 },
  ],
};

export const DEFAULT_SURAT_TUGAS_SCHEMA: FormFieldSchema[] = [
  {
    key: 'document_title',
    label: 'Judul Dokumen',
    type: 'text',
    required: true,
    defaultValue: 'SURAT TUGAS',
    placeholder: 'Contoh: SURAT TUGAS',
  },
  {
    key: 'signer_title_intro',
    label: 'Jabatan Pemberi Tugas (Intro)',
    type: 'text',
    required: true,
    defaultValue: 'Project Director Kian Troopers',
    placeholder: 'Contoh: Project Director Kian Troopers',
    helpText: 'Teks pengantar di bagian atas ("Yang bertanda tangan dibawah ini, ...")',
  },
  {
    key: 'intro_text',
    label: 'Kalimat Pembuka',
    type: 'textarea',
    required: true,
    defaultValue:
      'Yang bertanda tangan dibawah ini, {signer_title_intro}, menugaskan kepada :',
    placeholder: 'Kalimat pembuka penugasan...',
  },
  {
    key: 'assignees',
    label: 'Daftar Petugas / Personil',
    type: 'assignee_table',
    required: true,
    defaultValue: [
      {
        no: 1,
        nip: '17250703',
        name: 'Muhammad Naufal Revian',
        role: 'Camera Operator',
      },
    ],
    helpText: 'Tambah personil dari database users atau masukkan manual.',
  },
  {
    key: 'event_intro_text',
    label: 'Kalimat Pengantar Event',
    type: 'textarea',
    required: true,
    defaultValue:
      'Untuk berpartisipasi pada event {event_name}, dengan rincian sebagai berikut:',
  },
  {
    key: 'event_name',
    label: 'Nama Event / Proyek',
    type: 'text',
    required: true,
    defaultValue: 'BKOT (Bincang Kampus Bersama Orang Tua) UBSI',
    placeholder: 'Contoh: BKOT UBSI 2026',
  },
  {
    key: 'event_days',
    label: 'Hari / Tanggal Pelaksanaan',
    type: 'text',
    required: true,
    defaultValue: "Jum'at - Sabtu, 11 - 12 September 2026",
    placeholder: 'Contoh: Sabtu, 12 September 2026',
  },
  {
    key: 'event_time',
    label: 'Waktu / Pukul',
    type: 'text',
    required: true,
    defaultValue: '07.30 WIB - Selesai',
    placeholder: 'Contoh: 08.00 WIB - 17.00 WIB',
  },
  {
    key: 'event_location',
    label: 'Tempat / Lokasi',
    type: 'text',
    required: true,
    defaultValue: 'Hotel Santika Depok',
    placeholder: 'Contoh: Hotel Santika Depok / Gedung Graha Kian',
  },
  {
    key: 'closing_text',
    label: 'Kalimat Penutup',
    type: 'textarea',
    required: true,
    defaultValue:
      'Demikianlah penugasan ini agar dapat dilaksanakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.',
  },
  {
    key: 'document_date_place',
    label: 'Tempat & Tanggal Surat',
    type: 'text',
    required: true,
    defaultValue: 'Jakarta, 10 September 2026',
    placeholder: 'Contoh: Jakarta, 10 September 2026',
  },
  {
    key: 'signatory_position',
    label: 'Jabatan Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Program Director Kian Troopers',
    placeholder: 'Contoh: Program Director Kian Troopers',
  },
  {
    key: 'signatory_name',
    label: 'Nama Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Mohamad Abi',
    placeholder: 'Contoh: Mohamad Abi',
  },
  {
    key: 'show_signature',
    label: 'Tampilkan Tanda Tangan Basah (Gambar)',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_stamp',
    label: 'Tampilkan Stempel / Cap Resmi KIAN',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_qr_verification',
    label: 'Tampilkan TTD Digital (QR Code Verifikasi Resmi)',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'cc_list',
    label: 'Tembusan (CC)',
    type: 'repeatable_list',
    required: false,
    defaultValue: ['1. CEO', '2. CBO', '3. Ybs'],
    helpText: 'Daftar pihak yang menerima tembusan surat.',
  },
];

export const DEFAULT_SURAT_TUGAS_VALUES = {
  document_title: 'SURAT TUGAS',
  signer_title_intro: 'Project Director Kian Troopers',
  intro_text:
    'Yang bertanda tangan dibawah ini, Project Director Kian Troopers, menugaskan kepada :',
  assignees: [
    {
      no: 1,
      nip: '17250703',
      name: 'Muhammad Naufal Revian',
      role: 'Camera Operator',
    },
  ],
  event_intro_text:
    'Untuk berpartisipasi pada event BKOT (Bincang Kampus Bersama Orang Tua) UBSI, dengan rincian sebagai berikut:',
  event_name: 'BKOT (Bincang Kampus Bersama Orang Tua) UBSI',
  event_days: "Jum'at - Sabtu, 11 - 12 September 2026",
  event_time: '07.30 WIB - Selesai',
  event_location: 'Hotel Santika Depok',
  closing_text:
    'Demikianlah penugasan ini agar dapat dilaksanakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.',
  document_date_place: 'Jakarta, 10 September 2026',
  signatory_position: 'Program Director Kian Troopers',
  signatory_name: 'Mohamad Abi',
  show_signature: true,
  show_stamp: true,
  show_qr_verification: true,
  cc_list: ['1. CEO', '2. CBO', '3. Ybs'],
};

// ============================================================================
// 2. SURAT UNDANGAN (INVITATION LETTER)
// ============================================================================
export const DEFAULT_SURAT_UNDANGAN_LAYOUT: TemplateLayoutConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  paddingMm: { top: 14, bottom: 14, left: 15, right: 15 },
  contentPaddingLeftPx: 56,
  contentPaddingRightPx: 56,
  fontFamily: 'Times New Roman',
  fontSizeBasePt: 10.5,
  primaryColor: '#002B7F',
  kopConfig: {
    frameAssetUrl: '',
    frameOpacity: 1,
    kopHeightPx: 215,
    logo: { enabled: true, x: 56, y: 44, width: 220, height: 48 },
    titleBlock: {
      enabled: true,
      x: 56,
      y: 138,
      width: 682,
      align: 'center',
      titleFontSizePt: 13,
      numberFontSizePt: 10,
    },
    customTexts: [],
  },
  signatureConfig: {
    align: 'right',
    showSignature: true,
    showStamp: true,
    showQrVerification: true,
    signatureType: 'BOTH',
    qrSize: 84,
  },
  tableColumns: [],
  flowSections: [
    { id: 'sec_recipient', type: 'RECIPIENT_BLOCK', visible: true, spacingBottomMm: 4 },
    { id: 'sec_intro', type: 'INTRO_TEXT', visible: true, spacingBottomMm: 4 },
    { id: 'sec_event', type: 'KEY_VALUE_GRID', visible: true, spacingBottomMm: 6 },
    { id: 'sec_body', type: 'PARAGRAPH', visible: true, spacingBottomMm: 6 },
    { id: 'sec_closing', type: 'CLOSING_TEXT', visible: true, spacingBottomMm: 8 },
    { id: 'sec_sig', type: 'SIGNATURE_BLOCK', visible: true, spacingBottomMm: 6 },
    { id: 'sec_cc', type: 'TEMBUSAN_BLOCK', visible: true, spacingBottomMm: 4 },
  ],
};

export const DEFAULT_SURAT_UNDANGAN_SCHEMA: FormFieldSchema[] = [
  {
    key: 'document_title',
    label: 'Judul Dokumen',
    type: 'text',
    required: true,
    defaultValue: 'SURAT UNDANGAN',
  },
  {
    key: 'recipient_info',
    label: 'Kepada Yth. (Penerima Undangan)',
    type: 'textarea',
    required: true,
    defaultValue: 'Kepada Yth.\nBapak/Ibu Pimpinan Mitra / Civitas Akademika\ndi Tempat',
    helpText: 'Tuliskan nama penerima undangan, instansi, dan alamat.',
  },
  {
    key: 'intro_text',
    label: 'Kalimat Pembuka',
    type: 'textarea',
    required: true,
    defaultValue:
      'Dengan hormat,\nSehubungan dengan akan diadakannya agenda kegiatan {event_name}, bersama ini kami bermaksud mengundang Bapak/Ibu untuk dapat hadir dan berpartisipasi pada kegiatan yang akan dilaksanakan pada:',
  },
  {
    key: 'event_name',
    label: 'Nama Kegiatan / Acara',
    type: 'text',
    required: true,
    defaultValue: 'Rapat Koordinasi & Sinergi Program KIAN Troopers 2026',
  },
  {
    key: 'event_days',
    label: 'Hari / Tanggal',
    type: 'text',
    required: true,
    defaultValue: 'Senin, 15 September 2026',
  },
  {
    key: 'event_time',
    label: 'Waktu / Pukul',
    type: 'text',
    required: true,
    defaultValue: '09.00 WIB - Selesai',
  },
  {
    key: 'event_location',
    label: 'Tempat / Media',
    type: 'text',
    required: true,
    defaultValue: 'Graha KIAN Troopers / Zoom Meeting Room',
  },
  {
    key: 'event_agenda',
    label: 'Agenda / Topik Pembahasan',
    type: 'text',
    required: false,
    defaultValue: 'Pembahasan Rencana Kolaborasi Event Akbar & Sosialisasi Timeline',
  },
  {
    key: 'body_content',
    label: 'Catatan / Teks Tambahan',
    type: 'textarea',
    required: false,
    defaultValue:
      'Mengingat pentingnya agenda tersebut, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya. Konfirmasi kehadiran dapat disampaikan selambat-lambatnya H-1 kegiatan.',
  },
  {
    key: 'closing_text',
    label: 'Kalimat Penutup',
    type: 'textarea',
    required: true,
    defaultValue:
      'Demikian surat undangan ini kami sampaikan. Atas perhatian, kehadiran, dan kerja sama yang baik, kami ucapkan terima kasih.',
  },
  {
    key: 'document_date_place',
    label: 'Tempat & Tanggal Surat',
    type: 'text',
    required: true,
    defaultValue: 'Jakarta, 10 September 2026',
  },
  {
    key: 'signatory_position',
    label: 'Jabatan Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Chief Executive Officer (CEO)',
  },
  {
    key: 'signatory_name',
    label: 'Nama Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Mohamad Abi',
  },
  {
    key: 'show_signature',
    label: 'Tampilkan TTD Basah (Gambar)',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_stamp',
    label: 'Tampilkan Stempel / Cap Resmi KIAN',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_qr_verification',
    label: 'Tampilkan TTD Digital (QR Code)',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'cc_list',
    label: 'Tembusan (CC)',
    type: 'repeatable_list',
    required: false,
    defaultValue: ['1. Arsip Sekretariat KIAN'],
  },
];

export const DEFAULT_SURAT_UNDANGAN_VALUES = {
  document_title: 'SURAT UNDANGAN',
  recipient_info: 'Kepada Yth.\nBapak/Ibu Pimpinan Mitra / Civitas Akademika\ndi Tempat',
  intro_text:
    'Dengan hormat,\nSehubungan dengan akan diadakannya agenda kegiatan Rapat Koordinasi & Sinergi Program KIAN Troopers 2026, bersama ini kami bermaksud mengundang Bapak/Ibu untuk dapat hadir dan berpartisipasi pada kegiatan yang akan dilaksanakan pada:',
  event_name: 'Rapat Koordinasi & Sinergi Program KIAN Troopers 2026',
  event_days: 'Senin, 15 September 2026',
  event_time: '09.00 WIB - Selesai',
  event_location: 'Graha KIAN Troopers / Zoom Meeting Room',
  event_agenda: 'Pembahasan Rencana Kolaborasi Event Akbar & Sosialisasi Timeline',
  body_content:
    'Mengingat pentingnya agenda tersebut, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya. Konfirmasi kehadiran dapat disampaikan selambat-lambatnya H-1 kegiatan.',
  closing_text:
    'Demikian surat undangan ini kami sampaikan. Atas perhatian, kehadiran, dan kerja sama yang baik, kami ucapkan terima kasih.',
  document_date_place: 'Jakarta, 10 September 2026',
  signatory_position: 'Chief Executive Officer (CEO)',
  signatory_name: 'Mohamad Abi',
  show_signature: true,
  show_stamp: true,
  show_qr_verification: true,
  cc_list: ['1. Arsip Sekretariat KIAN'],
};

// ============================================================================
// 3. SURAT KETERANGAN (STATEMENT / CERTIFICATE LETTER)
// ============================================================================
export const DEFAULT_SURAT_KETERANGAN_LAYOUT: TemplateLayoutConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  paddingMm: { top: 14, bottom: 14, left: 15, right: 15 },
  contentPaddingLeftPx: 56,
  contentPaddingRightPx: 56,
  fontFamily: 'Times New Roman',
  fontSizeBasePt: 10.5,
  primaryColor: '#002B7F',
  kopConfig: {
    frameAssetUrl: '',
    frameOpacity: 1,
    kopHeightPx: 215,
    logo: { enabled: true, x: 56, y: 44, width: 220, height: 48 },
    titleBlock: {
      enabled: true,
      x: 56,
      y: 138,
      width: 682,
      align: 'center',
      titleFontSizePt: 13,
      numberFontSizePt: 10,
    },
    customTexts: [],
  },
  signatureConfig: {
    align: 'right',
    showSignature: true,
    showStamp: true,
    showQrVerification: true,
    signatureType: 'BOTH',
    qrSize: 84,
  },
  tableColumns: [],
  flowSections: [
    { id: 'sec_intro', type: 'INTRO_TEXT', visible: true, spacingBottomMm: 4 },
    { id: 'sec_person', type: 'KEY_VALUE_GRID', visible: true, spacingBottomMm: 6 },
    { id: 'sec_body', type: 'PARAGRAPH', visible: true, spacingBottomMm: 6 },
    { id: 'sec_closing', type: 'CLOSING_TEXT', visible: true, spacingBottomMm: 8 },
    { id: 'sec_sig', type: 'SIGNATURE_BLOCK', visible: true, spacingBottomMm: 6 },
  ],
};

export const DEFAULT_SURAT_KETERANGAN_SCHEMA: FormFieldSchema[] = [
  {
    key: 'document_title',
    label: 'Judul Dokumen',
    type: 'text',
    required: true,
    defaultValue: 'SURAT KETERANGAN',
  },
  {
    key: 'intro_text',
    label: 'Kalimat Pembuka',
    type: 'textarea',
    required: true,
    defaultValue:
      'Yang bertanda tangan di bawah ini, Direktur Program KIAN Troopers, dengan ini menerangkan bahwa:',
  },
  {
    key: 'person_name',
    label: 'Nama Lengkap',
    type: 'text',
    required: true,
    defaultValue: 'Muhammad Naufal Revian',
  },
  {
    key: 'person_nip',
    label: 'NIP / NIM / No. Induk',
    type: 'text',
    required: true,
    defaultValue: '17250703',
  },
  {
    key: 'person_role',
    label: 'Jabatan / Posisi / Divisi',
    type: 'text',
    required: true,
    defaultValue: 'Production Crew & Multimedia Specialist',
  },
  {
    key: 'person_institution',
    label: 'Institusi / Universitas / Asal',
    type: 'text',
    required: false,
    defaultValue: 'Universitas Bina Sarana Informatika (UBSI)',
  },
  {
    key: 'body_content',
    label: 'Isi Pernyataan / Keterangan',
    type: 'textarea',
    required: true,
    defaultValue:
      'Adalah benar yang bersangkutan telah aktif melaksanakan penugasan dan praktik kerja industri (OJT/Magang) di KIAN Troopers selama periode Januari 2026 sampai dengan September 2026 dengan dedikasi, kedisiplinan, dan kinerja yang sangat memuaskan.',
  },
  {
    key: 'closing_text',
    label: 'Kalimat Penutup',
    type: 'textarea',
    required: true,
    defaultValue:
      'Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
  },
  {
    key: 'document_date_place',
    label: 'Tempat & Tanggal Surat',
    type: 'text',
    required: true,
    defaultValue: 'Jakarta, 10 September 2026',
  },
  {
    key: 'signatory_position',
    label: 'Jabatan Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Program Director Kian Troopers',
  },
  {
    key: 'signatory_name',
    label: 'Nama Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Mohamad Abi',
  },
  {
    key: 'show_signature',
    label: 'Tampilkan TTD Basah',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_stamp',
    label: 'Tampilkan Stempel Resmi KIAN',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_qr_verification',
    label: 'Tampilkan TTD Digital (QR Code)',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
];

export const DEFAULT_SURAT_KETERANGAN_VALUES = {
  document_title: 'SURAT KETERANGAN',
  intro_text:
    'Yang bertanda tangan di bawah ini, Direktur Program KIAN Troopers, dengan ini menerangkan bahwa:',
  person_name: 'Muhammad Naufal Revian',
  person_nip: '17250703',
  person_role: 'Production Crew & Multimedia Specialist',
  person_institution: 'Universitas Bina Sarana Informatika (UBSI)',
  body_content:
    'Adalah benar yang bersangkutan telah aktif melaksanakan penugasan dan praktik kerja industri (OJT/Magang) di KIAN Troopers selama periode Januari 2026 sampai dengan September 2026 dengan dedikasi, kedisiplinan, dan kinerja yang sangat memuaskan.',
  closing_text:
    'Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
  document_date_place: 'Jakarta, 10 September 2026',
  signatory_position: 'Program Director Kian Troopers',
  signatory_name: 'Mohamad Abi',
  show_signature: true,
  show_stamp: true,
  show_qr_verification: true,
};

// ============================================================================
// 4. SURAT PERNYATAAN (DECLARATION LETTER)
// ============================================================================
export const DEFAULT_SURAT_PERNYATAAN_LAYOUT: TemplateLayoutConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  paddingMm: { top: 14, bottom: 14, left: 15, right: 15 },
  contentPaddingLeftPx: 56,
  contentPaddingRightPx: 56,
  fontFamily: 'Times New Roman',
  fontSizeBasePt: 10.5,
  primaryColor: '#002B7F',
  kopConfig: {
    frameAssetUrl: '',
    frameOpacity: 1,
    kopHeightPx: 215,
    logo: { enabled: true, x: 56, y: 44, width: 220, height: 48 },
    titleBlock: {
      enabled: true,
      x: 56,
      y: 138,
      width: 682,
      align: 'center',
      titleFontSizePt: 13,
      numberFontSizePt: 10,
    },
    customTexts: [],
  },
  signatureConfig: {
    align: 'right',
    showSignature: true,
    showStamp: true,
    showQrVerification: true,
    signatureType: 'BOTH',
    qrSize: 84,
  },
  tableColumns: [],
  flowSections: [
    { id: 'sec_intro', type: 'INTRO_TEXT', visible: true, spacingBottomMm: 4 },
    { id: 'sec_person', type: 'KEY_VALUE_GRID', visible: true, spacingBottomMm: 6 },
    { id: 'sec_body', type: 'PARAGRAPH', visible: true, spacingBottomMm: 4 },
    { id: 'sec_points', type: 'REPEATABLE_LIST', visible: true, spacingBottomMm: 6 },
    { id: 'sec_closing', type: 'CLOSING_TEXT', visible: true, spacingBottomMm: 8 },
    { id: 'sec_sig', type: 'SIGNATURE_BLOCK', visible: true, spacingBottomMm: 6 },
  ],
};

export const DEFAULT_SURAT_PERNYATAAN_SCHEMA: FormFieldSchema[] = [
  {
    key: 'document_title',
    label: 'Judul Dokumen',
    type: 'text',
    required: true,
    defaultValue: 'SURAT PERNYATAAN',
  },
  {
    key: 'intro_text',
    label: 'Kalimat Pembuka',
    type: 'textarea',
    required: true,
    defaultValue: 'Yang bertanda tangan di bawah ini:',
  },
  {
    key: 'person_name',
    label: 'Nama Lengkap',
    type: 'text',
    required: true,
    defaultValue: 'Mohamad Abi',
  },
  {
    key: 'person_role',
    label: 'Jabatan / Posisi',
    type: 'text',
    required: true,
    defaultValue: 'Program Director Kian Troopers',
  },
  {
    key: 'person_address',
    label: 'Alamat / Domisili',
    type: 'text',
    required: false,
    defaultValue: 'Jakarta Timur, DKI Jakarta',
  },
  {
    key: 'body_content',
    label: 'Teks Pengantar Pernyataan',
    type: 'textarea',
    required: true,
    defaultValue:
      'Dengan ini menyatakan dengan sesungguhnya dan penuh rasa tanggung jawab bahwa:',
  },
  {
    key: 'statement_points',
    label: 'Poin-Poin Pernyataan',
    type: 'repeatable_list',
    required: true,
    defaultValue: [
      '1. Seluruh data dan informasi yang tercantum dalam dokumen ini adalah benar dan valid.',
      '2. Bersedia mematuhi segala standar operasional prosedur dan etika profesional KIAN Troopers.',
      '3. Bertanggung jawab penuh atas pelaksanaan kegiatan dan pelaporan hasil tugas secara transparan.',
    ],
  },
  {
    key: 'closing_text',
    label: 'Kalimat Penutup',
    type: 'textarea',
    required: true,
    defaultValue:
      'Demikian surat pernyataan ini saya buat dengan sadar tanpa paksaan dari pihak manapun untuk dipergunakan sebagaimana mestinya.',
  },
  {
    key: 'document_date_place',
    label: 'Tempat & Tanggal Surat',
    type: 'text',
    required: true,
    defaultValue: 'Jakarta, 10 September 2026',
  },
  {
    key: 'signatory_position',
    label: 'Yang Membuat Pernyataan',
    type: 'text',
    required: true,
    defaultValue: 'Program Director Kian Troopers',
  },
  {
    key: 'signatory_name',
    label: 'Nama Penandatangan',
    type: 'text',
    required: true,
    defaultValue: 'Mohamad Abi',
  },
  {
    key: 'show_signature',
    label: 'Tampilkan TTD Basah',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_stamp',
    label: 'Tampilkan Stempel Resmi KIAN',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
  {
    key: 'show_qr_verification',
    label: 'Tampilkan TTD Digital (QR Code)',
    type: 'checkbox',
    required: false,
    defaultValue: true,
  },
];

export const DEFAULT_SURAT_PERNYATAAN_VALUES = {
  document_title: 'SURAT PERNYATAAN',
  intro_text: 'Yang bertanda tangan di bawah ini:',
  person_name: 'Mohamad Abi',
  person_role: 'Program Director Kian Troopers',
  person_address: 'Jakarta Timur, DKI Jakarta',
  body_content:
    'Dengan ini menyatakan dengan sesungguhnya dan penuh rasa tanggung jawab bahwa:',
  statement_points: [
    '1. Seluruh data dan informasi yang tercantum dalam dokumen ini adalah benar dan valid.',
    '2. Bersedia mematuhi segala standar operasional prosedur dan etika profesional KIAN Troopers.',
    '3. Bertanggung jawab penuh atas pelaksanaan kegiatan dan pelaporan hasil tugas secara transparan.',
  ],
  closing_text:
    'Demikian surat pernyataan ini saya buat dengan sadar tanpa paksaan dari pihak manapun untuk dipergunakan sebagaimana mestinya.',
  document_date_place: 'Jakarta, 10 September 2026',
  signatory_position: 'Program Director Kian Troopers',
  signatory_name: 'Mohamad Abi',
  show_signature: true,
  show_stamp: true,
  show_qr_verification: true,
};

// ============================================================================
// HELPER: GET STARTER TEMPLATE FOR ANY DOCUMENT TYPE CODE
// ============================================================================
export function getDefaultTemplateForType(typeCode: string): {
  layout_config: TemplateLayoutConfig;
  form_schema: FormFieldSchema[];
  default_values: Record<string, any>;
  sample_data: Record<string, any>;
  name: string;
} {
  const code = (typeCode || '').toUpperCase().trim();

  if (code.includes('UNDANGAN')) {
    return {
      layout_config: DEFAULT_SURAT_UNDANGAN_LAYOUT,
      form_schema: DEFAULT_SURAT_UNDANGAN_SCHEMA,
      default_values: DEFAULT_SURAT_UNDANGAN_VALUES,
      sample_data: DEFAULT_SURAT_UNDANGAN_VALUES,
      name: 'Surat Undangan Resmi KIAN Troopers',
    };
  }

  if (code.includes('KETERANGAN')) {
    return {
      layout_config: DEFAULT_SURAT_KETERANGAN_LAYOUT,
      form_schema: DEFAULT_SURAT_KETERANGAN_SCHEMA,
      default_values: DEFAULT_SURAT_KETERANGAN_VALUES,
      sample_data: DEFAULT_SURAT_KETERANGAN_VALUES,
      name: 'Surat Keterangan Aktif / Pengalaman KIAN Troopers',
    };
  }

  if (code.includes('PERNYATAAN')) {
    return {
      layout_config: DEFAULT_SURAT_PERNYATAAN_LAYOUT,
      form_schema: DEFAULT_SURAT_PERNYATAAN_SCHEMA,
      default_values: DEFAULT_SURAT_PERNYATAAN_VALUES,
      sample_data: DEFAULT_SURAT_PERNYATAAN_VALUES,
      name: 'Surat Pernyataan Komitmen & Tanggung Jawab',
    };
  }

  // Default fallback is Surat Tugas
  return {
    layout_config: DEFAULT_SURAT_TUGAS_LAYOUT,
    form_schema: DEFAULT_SURAT_TUGAS_SCHEMA,
    default_values: DEFAULT_SURAT_TUGAS_VALUES,
    sample_data: DEFAULT_SURAT_TUGAS_VALUES,
    name: 'Surat Tugas KIAN Troopers',
  };
}
