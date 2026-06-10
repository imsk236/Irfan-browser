export interface Repository {
  id: number;
  place_key: string;
  name: string;
  kind: string;
  notes: string | null;
}

export interface Volume {
  id: number;
  repository_id: number;
  document_number: number;
  serial: string;
  library_shelfmark: string | null;
  folio_count: number | null;
  notes: string | null;
}

export interface Work {
  id: number;
  volume_id: number;
  title: string;
  work_type: string | null;
  start_unit: string | null;
  end_unit: string | null;
  notes: string | null;
}

export interface Annotation {
  id: number;
  volume_id: number;
  work_id: number | null;
  annotation_type: string;
  text_as_written: string | null;
  date_as_written: string | null;
  date_earliest: number | null;
  date_latest: number | null;
  date_precision: string | null;
  image_location: string | null;
  notes: string | null;
}

export interface Person {
  id: number;
  preferred_name: string;
  ism: string | null;
  nisba_1: string | null;
  nisba_2: string | null;
  laqab: string | null;
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
  confidence: string;
  evidence_source: string | null;
  evidence_annotation_id: number | null;
  notes: string | null;
}

export interface TraceResult {
  relationship_id: number;
  role: string;
  level: string;
  confidence: string;
  serial: string;
  work_id: number | null;
  work_title: string | null;
  evidence_annotation_id: number | null;
  evidence_text: string | null;
  evidence_image_location: string | null;
  evidence_source: string | null;
  notes: string | null;
}
