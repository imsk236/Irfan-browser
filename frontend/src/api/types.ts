export interface Repository {
  id: number;
  place_key: string;
  name: string;
  location: string | null;
  notes: string | null;
}

export interface Volume {
  id: number;
  repository_id: number;
  document_number: number;
  serial: string;
  repository_volume_number: number | null;
  folio_count: number | null;
  notes: string | null;
}

export interface Work {
  id: number;
  volume_id: number;
  title: string;
  title_source: string | null;
  incipit: string | null;
  explicit: string | null;
  topic_category: string | null;
  topic_subcategory: string | null;
  start_unit: string | null;
  end_unit: string | null;
  copy_place: string | null;
  copy_date_as_written: string | null;
  copy_year: number | null;
  copy_month: string | null;
  copy_day: number | null;
  copy_weekday: string | null;
  copy_time: string | null;
  notes: string | null;
}

export interface Annotation {
  id: number;
  volume_id: number;
  work_id: number | null;
  annotation_type: string;
  text_as_written: string | null;
  image_location: string | null;
  notes: string | null;
}

export interface Person {
  id: number;
  preferred_name: string;
  ism: string | null;
  kunya: string | null;
  laqab: string | null;
  nisba_1: string | null;
  nisba_2: string | null;
  known_as: string | null;
  nasab: string | null;
  birth_date_as_written: string | null;
  birth_year_earliest: number | null;
  birth_year_latest: number | null;
  death_date_as_written: string | null;
  death_year_earliest: number | null;
  death_year_latest: number | null;
  birth_place: string | null;
  death_place: string | null;
  wilayas: string[];
  notes: string | null;
}

export interface PersonMatch {
  person_id: number;
  preferred_name: string;
  written_form: string;
  score: number;
  match_type: string;
}

export interface NameVariant {
  id: number;
  person_id: number;
  written_form: string;
  normalized_form: string | null;
  source_annotation_id: number | null;
  notes: string | null;
}

export interface Relationship {
  id: number;
  person_id: number;
  level: "work" | "volume";
  work_id: number | null;
  volume_id: number | null;
  role: string;
  evidence_source: string | null;
  evidence_annotation_id: number | null;
  notes: string | null;
}

export interface TraceResult {
  relationship_id: number;
  role: string;
  level: string;
  serial: string;
  repository_volume_number: number | null;
  work_id: number | null;
  work_title: string | null;
  evidence_annotation_id: number | null;
  evidence_annotation_type: string | null;
  evidence_text: string | null;
  evidence_image_location: string | null;
  evidence_source: string | null;
  notes: string | null;
}

// ── Dashboard types ───────────────────────────────────────────────────────────

export interface DashboardStats {
  volumes: number;
  works: number;
  persons: number;
  annotations: number;
  repositories: number;
}

export interface ActivityDay {
  date: string;   // YYYY-MM-DD Muscat local
  count: number;  // distinct commit_ids (saves) that day
}

export interface ActivityCalendar {
  days: ActivityDay[];
}

export interface ActivityEntry {
  id: number;
  table_name: string;
  record_id: number;
  action: string;  // create | update | delete
  label: string | null;
}

export interface Commit {
  commit_id: string;
  occurred_at: string;
  entries: ActivityEntry[];
}

export interface DayDetail {
  date: string;
  commits: Commit[];
}

export interface RecentEdit {
  table_name: string;
  record_id: number;
  action: string;
  label: string | null;
  occurred_at: string;
}

export interface ActionableCounts {
  incomplete_volumes: number;
  incomplete_works: number;
  weak_evidence: number;
  orphan_persons: number;
}

export interface RepositoryCount {
  id: number;
  name: string;
  place_key: string;
  volume_count: number;
}

/** Returned by GET /persons/{id}/appearances */
export interface Appearance {
  relationship_id: number;
  role: string;
  level: string;
  serial: string;
  repository_volume_number: number | null;
  work_id: number | null;
  work_title: string | null;
  evidence_annotation_id: number | null;
  evidence_annotation_type: string | null;
  evidence_text: string | null;
  evidence_image_location: string | null;
  evidence_source: string | null;
  notes: string | null;
}
