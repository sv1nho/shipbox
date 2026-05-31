import { describe, it, expect, vi, afterEach } from "vitest";
import { svg2pdf } from "svg2pdf.js";

vi.mock("jspdf", () => ({
  // Arrow functions can't be used as constructors — use a class mock instead
  jsPDF: class {
    output() {
      return new Blob(["fake-pdf"], { type: "application/pdf" });
    }
  },
}));

vi.mock("svg2pdf.js", () => ({
  svg2pdf: vi.fn().mockResolvedValue(undefined),
}));

import { svgToPdf, downloadPdf } from "../utils/pdf-generator.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── svgToPdf ──────────────────────────────────────────────────────────────────

describe("svgToPdf", () => {
  const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  it("returns a Blob for a valid SVG string", async () => {
    const result = await svgToPdf(VALID_SVG);
    expect(result).toBeInstanceOf(Blob);
  });

  it("strips the XML declaration before parsing", async () => {
    const svgWithDecl = `<?xml version="1.0" encoding="UTF-8"?>${VALID_SVG}`;
    await expect(svgToPdf(svgWithDecl)).resolves.toBeInstanceOf(Blob);
  });

  it("throws when the input has no <svg tag", async () => {
    await expect(svgToPdf("<div>not svg</div>")).rejects.toThrow("Invalid SVG");
  });

  it("throws on empty string", async () => {
    await expect(svgToPdf("")).rejects.toThrow("Invalid SVG");
  });

  it("throws when DOMParser returns a non-SVG root element", async () => {
    vi.spyOn(DOMParser.prototype, "parseFromString").mockReturnValue({
      documentElement: { nodeName: "parsererror" },
    } as unknown as Document);
    await expect(svgToPdf(VALID_SVG)).rejects.toThrow("Invalid SVG element");
  });

  it("wraps svg2pdf errors in a 'Failed to generate PDF' error", async () => {
    vi.mocked(svg2pdf).mockRejectedValueOnce(new Error("render failed"));
    await expect(svgToPdf(VALID_SVG)).rejects.toThrow(
      "Failed to generate PDF: render failed",
    );
  });
});

// ── downloadPdf ───────────────────────────────────────────────────────────────

describe("downloadPdf", () => {
  it("creates a temporary anchor, clicks it, then removes it and revokes the URL", () => {
    const mockUrl = "blob:mock-url";
    const clickSpy = vi.fn();
    const mockLink = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;

    vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue(mockLink);
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node);
    const removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node);

    downloadPdf(new Blob(["pdf"], { type: "application/pdf" }), "label.pdf");

    expect(mockLink.href).toBe(mockUrl);
    expect(mockLink.download).toBe("label.pdf");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(appendSpy).toHaveBeenCalledWith(mockLink);
    expect(removeSpy).toHaveBeenCalledWith(mockLink);
    expect(revokeSpy).toHaveBeenCalledWith(mockUrl);
  });

  it("defaults the filename to 'label.pdf' when none is provided", () => {
    const clickSpy = vi.fn();
    const mockLink = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue(mockLink);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    downloadPdf(new Blob());

    expect(mockLink.download).toBe("label.pdf");
  });
});
