import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Tool to fetch article content using Jina Reader API
 * Converts web pages to clean markdown format
 */
export const fetchArticleContent = createTool({
  id: "fetch-article-content",
  description: "Fetches full article content in markdown format using Jina Reader API",
  
  inputSchema: z.object({
    url: z.string().describe("The URL of the article to fetch"),
    title: z.string().optional().describe("The title of the article"),
  }),
  
  outputSchema: z.object({
    content: z.string().describe("Article content in markdown format"),
    url: z.string().describe("Original article URL"),
    title: z.string().optional(),
    success: z.boolean(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    
    logger?.info('🔧 [fetchArticleContent] Starting execution', { 
      url: context.url,
      title: context.title 
    });
    
    try {
      const jinaApiKey = process.env.JINA_API_KEY;
      
      if (!jinaApiKey) {
        throw new Error('JINA_API_KEY environment variable is not set');
      }
      
      logger?.info('📝 [fetchArticleContent] Fetching article via Jina Reader...');
      
      // Use Jina Reader API to fetch article content
      const jinaUrl = `https://r.jina.ai/${context.url}`;
      const response = await fetch(jinaUrl, {
        headers: {
          'Authorization': `Bearer ${jinaApiKey}`,
          'Accept': 'text/markdown',
        },
      });
      
      if (!response.ok) {
        logger?.error('❌ [fetchArticleContent] Jina API error', { 
          status: response.status,
          statusText: response.statusText 
        });
        
        return {
          content: '',
          url: context.url,
          title: context.title,
          success: false,
        };
      }
      
      const content = await response.text();
      
      logger?.info('✅ [fetchArticleContent] Completed successfully', { 
        url: context.url,
        contentLength: content.length 
      });
      
      return {
        content,
        url: context.url,
        title: context.title,
        success: true,
      };
      
    } catch (error) {
      logger?.error('❌ [fetchArticleContent] Error occurred', { 
        error,
        url: context.url 
      });
      
      return {
        content: '',
        url: context.url,
        title: context.title,
        success: false,
      };
    }
  },
});
