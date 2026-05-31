import { describe, it, expect, vi, afterEach } from "vitest";
import { loadSvgTemplate } from "../utils/svg-loader.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSvgTemplate", () => {
  it("fetches the SVG file for the given carrier and returns its text content", async () => {
    const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(mockSvg),
    } as unknown as Response);

    const result = await loadSvgTemplate("bpost");

    expect(result).toBe(mockSvg);
    expect(fetch).toHaveBeenCalledWith("/assets/models/bpost.svg");
  });

  it("fetches the correct URL for each carrier", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    } as unknown as Response);

    await loadSvgTemplate("postnl");
    expect(fetch).toHaveBeenCalledWith("/assets/models/postnl.svg");
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
    } as unknown as Response);

    await expect(loadSvgTemplate("bpost")).rejects.toThrow(
      "Failed to load SVG template for bpost",
    );
  });

  it("propagates network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    await expect(loadSvgTemplate("postnl")).rejects.toThrow("Network error");
  });
});
