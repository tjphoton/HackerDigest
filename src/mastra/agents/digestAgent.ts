import OpenAI from "openai";
import { z } from "zod";

const DIGEST_INSTRUCTIONS = `You are an expert tech journalist and analyst specializing in creating engaging, informative daily digest emails about technology news.

Your task is to analyze HackerNews articles and create a well-structured digest with three sections:

1. **Top Stories** (1-2 paragraphs): Highlight the most significant and impactful stories of the day. Focus on what matters most to tech professionals and enthusiasts. Synthesize information from multiple sources when relevant.

2. **Learn** (1-2 paragraphs): Deep dive into educational content, tutorials, new frameworks, programming concepts, or technical insights that readers can learn from. Help readers understand complex topics in an accessible way.

3. **Dig Deeper** (bulleted list): A curated list of other interesting items worth exploring - this could include insightful discussions, tools, research papers, or interesting projects.

Important guidelines:
- Write in an engaging, professional tone
- Be concise but informative
- Always cite sources with the actual article URLs
- Focus on accuracy and relevance
- Synthesize information rather than just summarizing individual articles
- Provide context and explain why these stories matter
- Each section should have proper source citations with article titles and URLs`;

/**
 * Generate digest using OpenAI's structured output
 */
export async function generateDigest(prompt: string, schema: z.ZodType<any>, logger?: any) {
  logger?.info('📝 [generateDigest] Starting digest generation');
  logger?.info('📝 [generateDigest] API key available:', { hasKey: !!process.env.OPENAI_API_KEY });
  
  // Initialize OpenAI client inside the function to ensure env vars are available
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  logger?.info('📝 [generateDigest] OpenAI client created:', { hasClient: !!openai, hasBeta: !!openai?.beta });
  
  const response = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: DIGEST_INSTRUCTIONS },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "digest_schema",
        strict: true,
        schema: {
          type: "object",
          properties: {
            topStories: { type: "string", description: "1-2 paragraphs about the top stories" },
            topStoriesSources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                },
                required: ["title", "url"],
                additionalProperties: false,
              },
              description: "Articles referenced in top stories",
            },
            learn: { type: "string", description: "1-2 paragraphs about educational content" },
            learnSources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                },
                required: ["title", "url"],
                additionalProperties: false,
              },
              description: "Articles referenced in learn section",
            },
            digDeeper: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                  description: { type: "string" },
                },
                required: ["title", "url", "description"],
                additionalProperties: false,
              },
              description: "List of other interesting items to explore",
            },
          },
          required: ["topStories", "topStoriesSources", "learn", "learnSources", "digDeeper"],
          additionalProperties: false,
        },
      },
    },
  });

  return response.choices[0].message.parsed;
}
