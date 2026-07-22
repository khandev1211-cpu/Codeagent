import { z } from "zod";

/**
 * Strips HTML tags and formats HTML content into basic plain text
 * @param {string} html 
 * @returns {string}
 */
function htmlToText(html) {
  return html
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const webFetchTool = {
  name: "web_fetch",
  description: "Fetch web content from an HTTP/HTTPS URL and convert HTML to readable plain text.",
  destructive: false,
  parameters: z.object({
    url: z.string().url().describe("The HTTP or HTTPS URL to fetch content from"),
  }),

  async execute({ url }) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "codeagent/0.1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const rawText = await response.text();

      if (contentType.includes("html")) {
        const text = htmlToText(rawText);
        return text.length > 5000 ? text.substring(0, 5000) + "\n...[truncated]" : text;
      }

      return rawText.length > 5000 ? rawText.substring(0, 5000) + "\n...[truncated]" : rawText;
    } catch (err) {
      throw new Error(`Failed to fetch URL '${url}': ${err.message}`);
    }
  },
};
