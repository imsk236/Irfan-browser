import { api } from "./client";
import type {
  Repository, Volume, Work, Annotation, Person, PersonMatch,
  NameVariant, Relationship, TraceResult, Appearance,
  DashboardStats, ActivityCalendar, DayDetail, RecentEdit,
  ActionableCounts, RepositoryCount, WilayaTraceResult,
} from "./types";

// Repositories & Volumes
export const volumesApi = {
  listRepositories: () => api.get<Repository[]>("/volumes/repositories"),
  createRepository: (body: Omit<Repository, "id">) =>
    api.post<Repository>("/volumes/repositories", body),
  getRepository: (id: number) =>
    api.get<Repository>(`/volumes/repositories/${id}`),
  updateRepository: (id: number, body: Partial<Omit<Repository, "id">>) =>
    api.patch<Repository>(`/volumes/repositories/${id}`, body),
  deleteRepository: (id: number) =>
    api.delete(`/volumes/repositories/${id}`),

  list: () => api.get<Volume[]>("/volumes"),
  get: (id: number) => api.get<Volume>(`/volumes/${id}`),
  nextDocumentNumber: (repositoryId: number) =>
    api.get<number>(`/volumes/next-document-number?repository_id=${repositoryId}`),
  create: (body: {
    repository_id: number;
    repository_volume_number?: number;
    folio_count?: number;
    notes?: string;
  }) => api.post<Volume>("/volumes", body),
  update: (id: number, body: Partial<Volume>) =>
    api.patch<Volume>(`/volumes/${id}`, body),
  delete: (id: number) => api.delete(`/volumes/${id}`),
};

// Works
export const worksApi = {
  listForVolume: (volumeId: number) =>
    api.get<Work[]>(`/works/by-volume/${volumeId}`),
  get: (id: number) => api.get<Work>(`/works/${id}`),
  create: (body: {
    volume_id: number;
    title: string;
    title_source?: string;
    incipit?: string;
    explicit?: string;
    topic_category?: string;
    topic_subcategory?: string;
    start_unit?: string;
    end_unit?: string;
    copy_place?: string;
    copy_date_as_written?: string;
    copy_year?: number;
    copy_month?: string;
    copy_day?: number;
    copy_weekday?: string;
    copy_time?: string;
    notes?: string;
  }) => api.post<Work>("/works", body),
  update: (id: number, body: Partial<Work>) =>
    api.patch<Work>(`/works/${id}`, body),
  delete: (id: number) => api.delete(`/works/${id}`),
};

// Annotations
export const annotationsApi = {
  listForVolume: (volumeId: number) =>
    api.get<Annotation[]>(`/annotations/by-volume/${volumeId}`),
  get: (id: number) => api.get<Annotation>(`/annotations/${id}`),
  create: (body: {
    volume_id: number;
    annotation_type: string;
    work_id?: number;
    text_as_written?: string;
    image_location?: string;
    notes?: string;
  }) => api.post<Annotation>("/annotations", body),
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
  addVariant: (id: number, body: {
    written_form: string;
    source_annotation_id?: number;
    notes?: string;
  }) => api.post<NameVariant>(`/persons/${id}/variants`, body),
  getWilayas: (id: number) =>
    api.get<string[]>(`/persons/${id}/wilayas`),
  setWilayas: (id: number, wilayas: string[]) =>
    api.put(`/persons/${id}/wilayas`, { wilayas }),
  appearances: (id: number) =>
    api.get<Appearance[]>(`/persons/${id}/appearances`),
  delete: (id: number) => api.delete(`/persons/${id}`),
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
  traceWilaya: (wilayaName: string) =>
    api.get<WilayaTraceResult>(`/trace/wilaya?name=${encodeURIComponent(wilayaName)}`),
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
  excel: (outputDir: string, researcherName: string) =>
    api.post<{ file: string }>("/export/excel", {
      output_dir: outputDir,
      researcher_name: researcherName,
    }),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/dashboard/stats"),
  activity: () => api.get<ActivityCalendar>("/dashboard/activity"),
  dayDetail: (date: string) => api.get<DayDetail>(`/dashboard/activity/${date}`),
  recent: (limit = 15) => api.get<RecentEdit[]>(`/dashboard/recent?limit=${limit}`),
  actionable: () => api.get<ActionableCounts>("/dashboard/actionable"),
  repositories: () => api.get<RepositoryCount[]>("/dashboard/repositories"),
};
