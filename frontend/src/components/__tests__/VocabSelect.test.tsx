/**
 * VocabSelect component tests.
 *
 * Scenario: researcher picks annotation type from a dropdown.
 * fetch is mocked per-test so each test controls what the API returns.
 */
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VocabSelect, VocabSelectOrOther } from "../VocabSelect";
import { setBaseUrl } from "../../api/client";

beforeEach(() => {
  setBaseUrl("http://127.0.0.1:8765");
  vi.restoreAllMocks();
});

function mockVocabFetch(values: string[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(values),
  });
}

describe("VocabSelect", () => {
  it("renders a select element", () => {
    mockVocabFetch([]);
    render(<VocabSelect category="annotation_type" value="" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows loading state initially before fetch resolves", () => {
    // Never-resolving fetch so we can observe loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<VocabSelect category="annotation_type" value="" onChange={() => {}} />);
    // Select is disabled while loading
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("renders options returned from the API", async () => {
    mockVocabFetch(["تملك", "وقف", "إهداء"]);
    render(
      <VocabSelect
        category="annotation_type"
        value=""
        onChange={() => {}}
        placeholder="اختر نوعاً"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).not.toBeDisabled();
    });

    expect(screen.getByRole("option", { name: "تملك" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "وقف" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "إهداء" })).toBeInTheDocument();
  });

  it("calls onChange with the selected value", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    mockVocabFetch(["تملك", "وقف"]);

    render(
      <VocabSelect
        category="annotation_type"
        value=""
        onChange={handleChange}
        placeholder="اختر"
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.selectOptions(screen.getByRole("combobox"), "وقف");

    expect(handleChange).toHaveBeenCalledWith("وقف");
  });

  it("renders placeholder option when provided", async () => {
    mockVocabFetch(["تملك"]);
    render(
      <VocabSelect
        category="annotation_type"
        value=""
        onChange={() => {}}
        placeholder="— اختر نوع القيد —"
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    expect(screen.getByRole("option", { name: "— اختر نوع القيد —" })).toBeInTheDocument();
  });

  it("renders without crashing when API returns empty array", async () => {
    mockVocabFetch([]);
    render(<VocabSelect category="annotation_type" value="" onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    // Only the empty placeholder option (if any) — no crash
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders without crashing when API call fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    render(<VocabSelect category="annotation_type" value="" onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    // Falls back to empty options — select is enabled but has no options
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("VocabSelectOrOther", () => {
  it("renders a غير ذلك option appended to the vocab list", async () => {
    mockVocabFetch(["تملك", "وقف"]);
    render(<VocabSelectOrOther category="annotation_type" value="" onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    expect(screen.getByRole("option", { name: "غير ذلك" })).toBeInTheDocument();
  });

  it("switches to a free-text input when غير ذلك is selected, clearing the value", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    mockVocabFetch(["تملك", "وقف"]);

    render(<VocabSelectOrOther category="annotation_type" value="" onChange={handleChange} />);

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.selectOptions(screen.getByRole("combobox"), "غير ذلك");

    expect(handleChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("passes typed free text straight through onChange", async () => {
    const user = userEvent.setup();
    mockVocabFetch(["تملك"]);

    function Wrapper() {
      const [value, setValue] = useState("");
      return <VocabSelectOrOther category="annotation_type" value={value} onChange={setValue} />;
    }

    render(<Wrapper />);
    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    await user.selectOptions(screen.getByRole("combobox"), "غير ذلك");

    await user.type(screen.getByRole("textbox"), "نوع مخصص");
    expect(screen.getByRole("textbox")).toHaveValue("نوع مخصص");
  });

  it("auto-detects a value not in the vocab list and starts in free-text mode", async () => {
    mockVocabFetch(["تملك", "وقف"]);
    render(<VocabSelectOrOther category="annotation_type" value="نوع قديم مخصص" onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    expect(screen.getByRole("textbox")).toHaveValue("نوع قديم مخصص");
  });

  it("returns to the dropdown and clears the value via the القائمة button", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    mockVocabFetch(["تملك", "وقف"]);

    render(<VocabSelectOrOther category="annotation_type" value="نوع قديم مخصص" onChange={handleChange} />);
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "القائمة" }));

    expect(handleChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("hides values passed via exclude, but still offers غير ذلك", async () => {
    mockVocabFetch(["مؤلف", "ناسخ", "مالك", "منسوخ له"]);
    render(
      <VocabSelectOrOther
        category="role"
        value=""
        onChange={() => {}}
        exclude={["مؤلف", "ناسخ", "منسوخ له"]}
      />
    );

    await waitFor(() => expect(screen.getByRole("combobox")).not.toBeDisabled());
    expect(screen.queryByRole("option", { name: "مؤلف" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "ناسخ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "منسوخ له" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "مالك" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "غير ذلك" })).toBeInTheDocument();
  });

  it("starts in free-text mode for an existing value that is now excluded", async () => {
    mockVocabFetch(["مؤلف", "مالك"]);
    render(
      <VocabSelectOrOther
        category="role"
        value="مؤلف"
        onChange={() => {}}
        exclude={["مؤلف"]}
      />
    );

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    expect(screen.getByRole("textbox")).toHaveValue("مؤلف");
  });
});
