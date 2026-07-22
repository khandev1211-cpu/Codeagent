import { z } from "zod";

export const webSearchTool = {
  name: "web_search",
  description: "Perform a web search query for technical documentation, libraries, or error solutions.",
  destructive: false,
  parameters: z.object({
    query: z.string().describe("The search terms or query"),
  }),

  async execute({ query }) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: { "User-Agent": "codeagent/0.1.0 (Mozilla/5.0)" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`);
      }

      const html = await response.text();
      // Extract result links and snippets from DuckDuckGo HTML
      const matches = [...html.matchAll(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi)];
      const snippets = matches
        .slice(0, 5)
        .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
        .filter(Boolean);

      if (snippets.length === 0) {
        return `No direct search snippets found for query: "${query}". Try refining your query.`;
      }

      return `Web Search Results for "${query}":\n\n` + snippets.map((s, i) => `${i + 1}. ${s}`).join("\n\n");
    } catch (err) {
      throw new Error(`Web search failed for query '${query}': ${err.message}`);
    }
  },
};
