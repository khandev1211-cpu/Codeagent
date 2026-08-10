import { describe, it, expect } from "vitest";
import { webFetchTool } from "../../src/tools/webFetch.js";
import { webSearchTool } from "../../src/tools/webSearch.js";

describe("Web Tools (web_fetch & web_search)", () => {
  it("defines correct schemas and names", () => {
    expect(webFetchTool.name).toBe("web_fetch");
    expect(webFetchTool.destructive).toBe(false);
    expect(webSearchTool.name).toBe("web_search");
    expect(webSearchTool.destructive).toBe(false);
  });

  it("handles web_fetch error gracefully for invalid domains", async () => {
    await expect(
      webFetchTool.execute({ url: "https://invalid-domain-that-does-not-exist-12345.com" })
    ).rejects.toThrow();
  });
});
