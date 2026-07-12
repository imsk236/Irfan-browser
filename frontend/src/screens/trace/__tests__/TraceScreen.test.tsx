/**
 * TraceScreen (البحث والتتبع) component tests — the unified search built in
 * ADR 0005. Exercises the real component end-to-end (render, type, click)
 * with fetch mocked per-route, matching this codebase's established
 * component-test convention (see PersonField.test.tsx / VocabSelect.test.tsx)
 * rather than introducing a new mocking library.
 *
 * Scenario: a researcher narrows a search by combining several fields, reads
 * the results (including a placeholder row for a volume matched with no
 * recorded relationship), filters by role, and opens a result's detail.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TraceScreen } from "../TraceScreen";
import { setBaseUrl } from "../../../api/client";
import type { Person, Work, Relationship, TraceResult } from "../../../api/types";

const BASE = "http://127.0.0.1:8765";

const REPOS = [
  { id: 1, place_key: "5001", name: "خزانة الشرقية", location: null, notes: null },
  { id: 2, place_key: "5002", name: "خزانة الباطنة", location: null, notes: null },
];

const PERSON: Person = {
  id: 10, preferred_name: "ابن النضر البهلوي", ism: null, kunya: null, laqab: null,
  nisba_1: null, nisba_2: null, known_as: null, nasab: null,
  birth_date_as_written: null, birth_year_earliest: null, birth_year_latest: null,
  death_date_as_written: null, death_year_earliest: null, death_year_latest: null,
  birth_place: null, death_place: null, wilayas: [], notes: null,
};

const WORK: Work = {
  id: 5, volume_id: 3, title: "رسالة في التوحيد", title_source: null, part_number: null,
  incipit: null, explicit: null, topic_category: null, topic_subcategory: null,
  start_unit: null, end_unit: null, copy_place: null, copy_date_as_written: null,
  copy_year: 1210, copy_month: null, copy_day: null, copy_weekday: null,
  copy_time: null, notes: null,
};

const AUTHOR_REL: Relationship = {
  id: 1, person_id: 10, level: "work", work_id: 5, volume_id: null,
  role: "مؤلف", evidence_source: null, evidence_annotation_id: null, notes: null,
};

const REAL_ROW: TraceResult = {
  relationship_id: 1, role: "مؤلف", level: "work", volume_id: 3,
  serial: "2240-0001", repository_volume_number: null, work_id: 5, work_title: "رسالة في التوحيد",
  evidence_annotation_id: null, evidence_annotation_type: null, evidence_text: "ملكه ابن النضر",
  evidence_image_location: null, evidence_source: "المخطوط", notes: null,
};

const SCRIBE_ROW: TraceResult = {
  relationship_id: 2, role: "ناسخ", level: "work", volume_id: 4,
  serial: "6187-0002", repository_volume_number: null, work_id: 6, work_title: "مقالة في الفقه",
  evidence_annotation_id: null, evidence_annotation_type: null, evidence_text: null,
  evidence_image_location: null, evidence_source: null, notes: null,
};

const PLACEHOLDER_ROW: TraceResult = {
  relationship_id: null, role: null, level: null, volume_id: 7,
  serial: "9999-0001", repository_volume_number: 77, work_id: null, work_title: null,
  evidence_annotation_id: null, evidence_annotation_type: null, evidence_text: null,
  evidence_image_location: null, evidence_source: null, notes: null,
};

interface FetchOptions {
  traceResults?: TraceResult[];
  traceStatus?: number;
  traceDetail?: string;
  personSearchResults?: unknown[];
}

function setupFetch({ traceResults = [], traceStatus = 200, traceDetail, personSearchResults = [] }: FetchOptions = {}) {
  global.fetch = vi.fn((url: string | URL) => {
    const path = String(url).replace(BASE, "");
    const ok = (body: unknown, status = 200) =>
      Promise.resolve({ ok: status >= 200 && status < 300, status, statusText: "OK", json: () => Promise.resolve(body) });

    if (path.startsWith("/volumes/repositories")) return ok(REPOS);
    if (path.startsWith("/persons/search")) return ok(personSearchResults);
    if (path.startsWith("/persons")) return ok([PERSON]);
    if (path.startsWith("/vocab/wilaya")) return ok(["نزوى", "صلالة"]);
    if (path.startsWith("/trace?")) {
      return traceStatus === 200
        ? ok(traceResults, 200)
        : ok({ detail: traceDetail ?? "خطأ" }, traceStatus);
    }
    if (path.startsWith("/works/5")) return ok(WORK);
    if (path.startsWith("/relationships/by-volume/3")) return ok([AUTHOR_REL]);
    return ok([]);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  setBaseUrl(BASE);
});

describe("TraceScreen — unified filter panel", () => {
  it("renders every filter field plus the بحث action", async () => {
    setupFetch();
    render(<TraceScreen />);

    expect(screen.getByLabelText("شخص")).toBeInTheDocument();
    expect(await screen.findByLabelText("منطقة العالم")).toBeInTheDocument();
    expect(screen.getByLabelText("مكان النسخ")).toBeInTheDocument();
    expect(screen.getByLabelText("العنوان")).toBeInTheDocument();
    expect(screen.getByLabelText("الرقم")).toBeInTheDocument();
    expect(screen.getByLabelText("الخزانة")).toBeInTheDocument();
    expect(screen.getByLabelText("سنة من")).toBeInTheDocument();
    expect(screen.getByLabelText("سنة إلى")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "بحث" })).toBeInTheDocument();
  });

  it("disables بحث until at least one filter is entered", async () => {
    const user = userEvent.setup();
    setupFetch();
    render(<TraceScreen />);

    const button = screen.getByRole("button", { name: "بحث" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("العنوان"), "رسالة");
    expect(button).toBeEnabled();
  });

  it("sends every filled field as a query param when بحث is clicked", async () => {
    const user = userEvent.setup();
    setupFetch({ traceResults: [] });
    render(<TraceScreen />);

    await user.type(screen.getByLabelText("العنوان"), "رسالة");
    await user.type(screen.getByLabelText("الرقم"), "2240");
    await user.type(screen.getByLabelText("سنة من"), "1200");
    await user.type(screen.getByLabelText("سنة إلى"), "1300");

    const regionSelect = await screen.findByLabelText("منطقة العالم");
    await waitFor(() => expect(within(regionSelect.closest("div")!).queryByText("نزوى")).toBeInTheDocument());
    await user.selectOptions(regionSelect, "نزوى");

    const repoSelect = screen.getByLabelText("الخزانة");
    await user.selectOptions(repoSelect, "خزانة الشرقية");

    await user.click(screen.getByRole("button", { name: "بحث" }));

    await waitFor(() => {
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls.find((args: unknown[]) => String(args[0]).startsWith(`${BASE}/trace?`));
      expect(call).toBeDefined();
      const url = new URL(String(call![0]));
      expect(url.searchParams.get("title")).toBe("رسالة");
      expect(url.searchParams.get("number")).toBe("2240");
      expect(url.searchParams.get("year_from")).toBe("1200");
      expect(url.searchParams.get("year_to")).toBe("1300");
      expect(url.searchParams.get("region")).toBe("نزوى");
      expect(url.searchParams.get("repository_id")).toBe("1");
    });
  });

  it("shows the empty-state message when the search returns no rows", async () => {
    const user = userEvent.setup();
    setupFetch({ traceResults: [] });
    render(<TraceScreen />);

    await user.type(screen.getByLabelText("العنوان"), "لا يوجد");
    await user.click(screen.getByRole("button", { name: "بحث" }));

    expect(await screen.findByText("لا توجد نتائج مطابقة.")).toBeInTheDocument();
  });

  it("shows the server error message when the search fails", async () => {
    const user = userEvent.setup();
    setupFetch({ traceStatus: 422, traceDetail: "يجب إدخال معيار بحث واحد على الأقل" });
    render(<TraceScreen />);

    await user.type(screen.getByLabelText("العنوان"), "أ");
    await user.click(screen.getByRole("button", { name: "بحث" }));

    expect(await screen.findByText(/يجب إدخال معيار بحث واحد على الأقل/)).toBeInTheDocument();
  });
});

describe("TraceScreen — results table", () => {
  it("renders role tabs with counts and a placeholder row under الكل", async () => {
    const user = userEvent.setup();
    setupFetch({ traceResults: [REAL_ROW, SCRIBE_ROW, PLACEHOLDER_ROW] });
    render(<TraceScreen />);

    await user.type(screen.getByLabelText("العنوان"), "ر");
    await user.click(screen.getByRole("button", { name: "بحث" }));

    expect(await screen.findByText("3 نتيجة")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /الكل/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /مؤلف/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ناسخ/ })).toBeInTheDocument();
    expect(screen.getByText("لا توجد علاقة مسجلة")).toBeInTheDocument();
  });

  it("hides the placeholder row once a specific role tab is selected", async () => {
    const user = userEvent.setup();
    setupFetch({ traceResults: [REAL_ROW, PLACEHOLDER_ROW] });
    render(<TraceScreen />);

    await user.type(screen.getByLabelText("العنوان"), "ر");
    await user.click(screen.getByRole("button", { name: "بحث" }));
    await screen.findByText("لا توجد علاقة مسجلة");

    await user.click(screen.getByRole("tab", { name: /مؤلف/ }));

    expect(screen.queryByText("لا توجد علاقة مسجلة")).not.toBeInTheDocument();
    expect(screen.getByText("رسالة في التوحيد")).toBeInTheDocument();
  });

  it("opens WorkDetailModal when a work-level row is clicked", async () => {
    const user = userEvent.setup();
    setupFetch({ traceResults: [REAL_ROW] });
    render(<TraceScreen />);

    await user.type(screen.getByLabelText("العنوان"), "ر");
    await user.click(screen.getByRole("button", { name: "بحث" }));

    const row = await screen.findByText("«ملكه ابن النضر»");
    await user.click(row.closest("tr")!);

    expect(await screen.findByRole("heading", { name: "رسالة في التوحيد" })).toBeInTheDocument();
  });

  it("navigates to the volume instead of opening a modal when a row has no عنوان", async () => {
    const user = userEvent.setup();
    const onNavigateToVolume = vi.fn();
    setupFetch({ traceResults: [PLACEHOLDER_ROW] });
    render(<TraceScreen onNavigateToVolume={onNavigateToVolume} />);

    await user.type(screen.getByLabelText("الرقم"), "77");
    await user.click(screen.getByRole("button", { name: "بحث" }));

    const row = await screen.findByText("لا توجد علاقة مسجلة");
    await user.click(row.closest("tr")!);

    expect(onNavigateToVolume).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("heading", { name: "رسالة في التوحيد" })).not.toBeInTheDocument();
  });
});
