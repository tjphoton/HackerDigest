import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Tool to fetch and parse HackerNews RSS feed
 * Extracts top story URLs from the front page
 */
export const fetchHackerNewsRss = createTool({
  id: "fetch-hackernews-rss",
  description: "Fetches the HackerNews RSS feed and extracts article URLs from top stories",
  
  inputSchema: z.object({
    limit: z.number().optional().describe("Maximum number of articles to fetch (default: 10)"),
  }),
  
  outputSchema: z.object({
    articles: z.array(z.object({
      title: z.string(),
      url: z.string(),
      hnUrl: z.string().describe("HackerNews discussion URL"),
    })),
    fetchedAt: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const limit = context.limit || 10;
    
    logger?.info('🔧 [fetchHackerNewsRss] Starting execution', { limit });
    
    try {
      logger?.info('📝 [fetchHackerNewsRss] Fetching HackerNews top stories...');
      
      // Fetch top stories IDs from HackerNews API
      const topStoriesResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      
      if (!topStoriesResponse.ok) {
        throw new Error(`Failed to fetch top stories: ${topStoriesResponse.status} ${topStoriesResponse.statusText}`);
      }
      
      const topStoriesIds: number[] = await topStoriesResponse.json();
      logger?.info('📝 [fetchHackerNewsRss] Found top stories', { count: topStoriesIds.length });
      
      // Fetch details for the top N stories
      const articles: Array<{ title: string; url: string; hnUrl: string }> = [];
      const storiesToFetch = topStoriesIds.slice(0, limit);
      
      for (const id of storiesToFetch) {
        try {
          const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          
          if (storyResponse.ok) {
            const story = await storyResponse.json();
            
            // Only include stories that have a URL (skip Ask HN, Show HN without URLs, etc.)
            if (story && story.url) {
              articles.push({
                title: story.title || 'Untitled',
                url: story.url,
                hnUrl: `https://news.ycombinator.com/item?id=${id}`,
              });
            }
          }
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger?.warn('⚠️ [fetchHackerNewsRss] Failed to fetch story', { id, error });
          // Continue with other stories
        }
      }
      
      logger?.info('✅ [fetchHackerNewsRss] Completed successfully', { 
        articlesFound: articles.length 
      });
      
      return {
        articles,
        fetchedAt: new Date().toISOString(),
      };
      
    } catch (error) {
      logger?.error('❌ [fetchHackerNewsRss] Error occurred', { error });
      throw error;
    }
  },
});
