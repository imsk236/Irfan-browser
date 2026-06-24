/**
 * PersonField component tests.
 *
 * Scenario: linking a scribe to a work via autocomplete. The component
 * debounces search input (250 ms). Tests use real timers and let waitFor
 * poll until the debounce fires — simpler and more reliable than fake timers.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonField } from "../PersonField";
import { setBaseUrl } from "../../api/client";

beforeEach(() => {
  setBaseUrl("http://127.0.0.1:8765");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const CANDIDATES = [
  {
    person_id: 1,
    preferred_name: "ابن النضر البهلوي",
    written_form: "ابن النضر",
    score: 99,
    match_type: "prefix",
  },
  {
    person_id: 2,
    preferred_name: "ابن النضر الأزكوي",
    written_form: "ابن النضر",
    score: 90,
    match_type: "token",
  },
];

function mockSearch(candidates: typeof CANDIDATES | []) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(candidates),
  });
}

describe("PersonField", () => {
  it("renders the input with the correct label", () => {
    mockSearch([]);
    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByLabelText("الناسخ")).toBeInTheDocument();
  });

  it("does not call fetch before typing anything", async () => {
    global.fetch = vi.fn();
    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    // Wait a bit to confirm no premature fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls search API after debounce when user types", async () => {
    const user = userEvent.setup();
    mockSearch(CANDIDATES);

    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    await user.type(screen.getByRole("combobox"), "ابن");

    await waitFor(
      () => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/persons/search?q="),
          expect.anything()
        );
      },
      { timeout: 2000 }
    );
  });

  it("shows candidate names in the dropdown after search resolves", async () => {
    const user = userEvent.setup();
    mockSearch(CANDIDATES);

    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    await user.type(screen.getByRole("combobox"), "ابن");

    await waitFor(
      () => {
        expect(screen.getByText("ابن النضر البهلوي")).toBeInTheDocument();
        expect(screen.getByText("ابن النضر الأزكوي")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("calls onChange with person_id and preferred_name when candidate is clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    mockSearch(CANDIDATES);

    render(<PersonField label="الناسخ" value={null} onChange={handleChange} />);
    await user.type(screen.getByRole("combobox"), "ابن");
    await waitFor(() => screen.getByText("ابن النضر البهلوي"), { timeout: 2000 });

    await user.click(screen.getByText("ابن النضر البهلوي"));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 1,
        preferred_name: "ابن النضر البهلوي",
      })
    );
  });

  it("shows create-new option when candidates are returned", async () => {
    const user = userEvent.setup();
    mockSearch(CANDIDATES);

    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    await user.type(screen.getByRole("combobox"), "ابن");

    await waitFor(
      () => expect(screen.getByText(/إنشاء شخص جديد/)).toBeInTheDocument(),
      { timeout: 2000 }
    );
  });

  it("shows create-new option even when search returns no results", async () => {
    const user = userEvent.setup();
    mockSearch([]);

    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    await user.type(screen.getByRole("combobox"), "اسم-لا-يوجد");

    await waitFor(
      () => expect(screen.getByText(/إنشاء شخص جديد/)).toBeInTheDocument(),
      { timeout: 2000 }
    );
  });

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup();
    mockSearch(CANDIDATES);

    render(<PersonField label="الناسخ" value={null} onChange={() => {}} />);
    await user.type(screen.getByRole("combobox"), "ابن");
    await waitFor(() => screen.getByRole("listbox"), { timeout: 2000 });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("calls onChange(null) when user types into the field after a value is selected", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    mockSearch(CANDIDATES);

    render(
      <PersonField
        label="الناسخ"
        value={{
          person_id: 1,
          preferred_name: "ابن النضر البهلوي",
          written_form: "ابن النضر",
        }}
        onChange={handleChange}
      />
    );

    // Typing clears the current selection
    await user.type(screen.getByRole("combobox"), "x");
    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
