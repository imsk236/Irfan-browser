/**
 * API layer tests — verify each function calls the correct HTTP method,
 * URL, and request body, and returns the parsed JSON on success.
 *
 * fetch is mocked globally; the base URL is the default 127.0.0.1:8765.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setBaseUrl } from "../client";
import {
  volumesApi,
  personsApi,
  dashboardApi,
  exportApi,
  traceApi,
} from "../index";

const BASE = "http://127.0.0.1:8765";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  setBaseUrl(BASE);
  vi.restoreAllMocks();
});

// ── volumesApi ──────────────────────────────────────────────────────────────

describe("volumesApi.list", () => {
  it("calls GET /volumes and returns parsed array", async () => {
    const fakeVolumes = [{ id: 1, serial: "0001-0001" }];
    global.fetch = mockFetch(200, fakeVolumes);

    const result = await volumesApi.list();

    expect(fetch).toHaveBeenCalledWith(`${BASE}/volumes`, expect.objectContaining({ method: "GET" }));
    expect(result).toEqual(fakeVolumes);
  });
});

describe("volumesApi.create", () => {
  it("calls POST /volumes with body and returns parsed volume", async () => {
    const fakeVol = { id: 2, serial: "0001-0002", repository_id: 1 };
    global.fetch = mockFetch(200, fakeVol);

    const result = await volumesApi.create({ repository_id: 1 });

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/volumes`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ repository_id: 1 }),
      })
    );
    expect(result).toEqual(fakeVol);
  });
});

describe("volumesApi.update", () => {
  it("calls PATCH /volumes/{id} with partial body", async () => {
    const updated = { id: 5, folio_count: 120, serial: "0001-0005" };
    global.fetch = mockFetch(200, updated);

    await volumesApi.update(5, { folio_count: 120 } as any);

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/volumes/5`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ folio_count: 120 }),
      })
    );
  });
});

// ── personsApi ──────────────────────────────────────────────────────────────

describe("personsApi.search", () => {
  it("calls GET /persons/search with encoded query", async () => {
    const fakeMatches = [{ person_id: 1, preferred_name: "ابن النضر", score: 100, match_type: "exact_written" }];
    global.fetch = mockFetch(200, fakeMatches);

    const result = await personsApi.search("ابن النضر", 10);

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/persons/search?q=${encodeURIComponent("ابن النضر")}&limit=10`,
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual(fakeMatches);
  });
});

describe("personsApi.setWilayas", () => {
  it("calls PUT /persons/{id}/wilayas with wilayas array", async () => {
    global.fetch = mockFetch(204, undefined);

    await personsApi.setWilayas(3, ["مسقط", "صلالة"]);

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/persons/3/wilayas`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ wilayas: ["مسقط", "صلالة"] }),
      })
    );
  });
});

// ── dashboardApi ─────────────────────────────────────────────────────────────

describe("dashboardApi.stats", () => {
  it("calls GET /dashboard/stats and returns parsed object", async () => {
    const fakeStats = { volumes: 12, works: 34, persons: 8, annotations: 21, repositories: 3 };
    global.fetch = mockFetch(200, fakeStats);

    const result = await dashboardApi.stats();

    expect(fetch).toHaveBeenCalledWith(`${BASE}/dashboard/stats`, expect.objectContaining({ method: "GET" }));
    expect(result).toEqual(fakeStats);
  });
});

// ── exportApi ────────────────────────────────────────────────────────────────

describe("exportApi.json", () => {
  it("calls POST /export/json with output_dir in body", async () => {
    const fakeResult = { file: "/tmp/ارشيف_عرفان_2026.json" };
    global.fetch = mockFetch(200, fakeResult);

    await exportApi.json("/tmp/export");

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/export/json`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("/tmp/export"),
      })
    );
  });
});

// ── traceApi ─────────────────────────────────────────────────────────────────

describe("traceApi.traceWilaya", () => {
  it("calls GET /trace/wilaya with encoded wilaya name", async () => {
    const fakeResult = { scholars: [], copies: [], repositories: [] };
    global.fetch = mockFetch(200, fakeResult);

    await traceApi.traceWilaya("مسقط");

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/trace/wilaya?name=${encodeURIComponent("مسقط")}`,
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("error handling", () => {
  it("throws on 404 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ detail: "المورد غير موجود" }),
    });

    await expect(volumesApi.get(999)).rejects.toThrow("المورد غير موجود");
  });

  it("throws on 500 response with status text fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(dashboardApi.stats()).rejects.toThrow();
  });

  it("propagates network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(volumesApi.list()).rejects.toThrow("Failed to fetch");
  });
});
