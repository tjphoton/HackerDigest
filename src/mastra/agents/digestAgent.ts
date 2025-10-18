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
  
  logger?.info('📝 [generateDigest] OpenAI client created');
  
  // Use JSON mode instead of beta parse for better compatibility
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: DIGEST_INSTRUCTIONS },
      { 
        role: "user", 
        content: `${prompt}

IMPORTANT: You must respond with a valid JSON object with the following structure:
{
  "topStories": "string with 1-2 paragraphs",
  "topStoriesSources": [{"title": "string", "url": "string"}],
  "learn": "string with 1-2 paragraphs",
  "learnSources": [{"title": "string", "url": "string"}],
  "digDeeper": [{"title": "string", "url": "string", "description": "string"}]
}`
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  logger?.info('📝 [generateDigest] Received response from OpenAI');
  
  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content in OpenAI response');
  }
  
  logger?.info('📝 [generateDigest] Parsing JSON response');
  const parsed = JSON.parse(content);
  
  logger?.info('📝 [generateDigest] Digest generated successfully');
  return parsed;
}
