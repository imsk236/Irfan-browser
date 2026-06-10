import { api } from "./client";
import type {
  Repository, Volume, Work, Annotation, Person, PersonMatch,
  NameVariant, Relationship, TraceResult,
} from "./types";

// Repositories & Volumes
export const volumesApi = {
  listRepositories: () => api.get<Repository[]>("/volumes/repositories"),
  createRepository: (body: Omit<Repository, "id">) =>
    api.post<Repository>("/volumes/repositories", body),

  list: () => api.get<Volume[]>("/volumes"),
  get: (id: number) => api.get<Volume>(`/volumes/${id}`),
  create: (body: { repository_id: number; library_shelfmark?: string; folio_count?: number; notes?: string }) =>
    api.post<Volume>("/volumes", body),
  update: (id: number, body: Partial<Volume>) =>
    api.patch<Volume>(`/volumes/${id}`, body),
  delete: (id: number) => api.delete(`/volumes/${id}`),
};

// Works
export const worksApi = {
  listForVolume: (volumeId: number) =>
    api.get<Work[]>(`/works/by-volume/${volumeId}`),
  get: (id: number) => api.get<Work>(`/works/${id}`),
  create: (body: { volume_id: number; title: string; work_type?: string; start_unit?: string; end_unit?: string; notes?: string }) =>
    api.post<Work>("/works", body),
  update: (id: number, body: Partial<Work>) =>
    api.patch<Work>(`/works/${id}`, body),
  delete: (id: number) => api.delete(`/works/${id}`),
};

// Annotations
export const annotationsApi = {
  listForVolume: (volumeId: number) =>
    api.get<Annotation[]>(`/annotations/by-volume/${volumeId}`),
  get: (id: number) => api.get<Annotation>(`/annotations/${id}`),
  create: (body: Partial<Annotation> & { volume_id: number; annotation_type: string }) =>
    api.post<Annotation>("/annotations", body),
  update: (id: number, body: Partial<Annotation>) =>
    api.patch<Annotation>(`/annotations/${id}`, body),
  delete: (id: number) => api.delete(`/annotations/${id}`),
};

// Persons
export const personsApi = {
  search: (q: string, limit = 10) =>
    api.get<PersonMatch[]>(`/persons/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  list: () => api.get<Person[]>("/persons"),
  get: (id: number) => api.get<Person>(`/persons/${id}`),
  create: (body: Partial<Person> & { preferred_name: string }) =>
    api.post<Person>("/persons", body),
  update: (id: number, body: Partial<Person>) =>
    api.patch<Person>(`/persons/${id}`, body),
  listVariants: (id: number) =>
    api.get<NameVariant[]>(`/persons/${id}/variants`),
  addVariant: (id: number, body: { written_form: string; source_annotation_id?: number; notes?: string }) =>
    api.post<NameVariant>(`/persons/${id}/variants`, body),
  setAncestors: (id: number, ancestors: string[]) =>
    api.put(`/persons/${id}/ancestors`, { ancestors }),
};

// Relationships
export const relationshipsApi = {
  listForVolume: (volumeId: number) =>
    api.get<Relationship[]>(`/relationships/by-volume/${volumeId}`),
  create: (body: Omit<Relationship, "id">) =>
    api.post<Relationship>("/relationships", body),
  delete: (id: number) => api.delete(`/relationships/${id}`),
};

// Trace
export const traceApi = {
  trace: (personId: number) =>
    api.get<TraceResult[]>(`/trace/${personId}`),
};

// Vocab
export const vocabApi = {
  list: (category: string) => api.get<string[]>(`/vocab/${category}`),
  add: (category: string, value: string) =>
    api.post(`/vocab/${category}`, { value }),
  deactivate: (category: string, value: string) =>
    api.delete(`/vocab/${category}/${encodeURIComponent(value)}`),
};

// Export
export const exportApi = {
  csv: (outputDir: string) =>
    api.post<{ files: string[] }>("/export/csv", { output_dir: outputDir }),
  json: (outputDir: string) =>
    api.post<{ file: string }>("/export/json", { output_dir: outputDir }),
};
