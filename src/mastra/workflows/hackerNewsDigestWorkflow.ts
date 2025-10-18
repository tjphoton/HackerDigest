import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { fetchHackerNewsRss } from "../tools/fetchHackerNewsRss";
import { fetchArticleContent } from "../tools/fetchArticleContent";
import { sendEmailViaResend } from "../tools/sendEmailViaResend";
import { generateDigest } from "../agents/digestAgent";
import { RuntimeContext } from "@mastra/core/di";

const runtimeContext = new RuntimeContext();

/**
 * Step 1: Fetch HackerNews RSS Feed
 */
const fetchRssStep = createStep({
  id: "fetch-rss",
  description: "Fetches top stories from HackerNews RSS feed",
  
  inputSchema: z.object({}).passthrough(),
  
  outputSchema: z.object({
    articles: z.array(z.object({
      title: z.string(),
      url: z.string(),
      hnUrl: z.string(),
    })),
  }),
  
  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 1] Fetching HackerNews RSS feed...');
    
    const result = await fetchHackerNewsRss.execute({
      context: { limit: 15 },
      runtimeContext,
      mastra,
    });
    
    logger?.info('✅ [Step 1] RSS feed fetched', { count: result.articles.length });
    
    return {
      articles: result.articles,
    };
  },
});

/**
 * Step 2: Fetch article content for each URL
 */
const fetchArticlesStep = createStep({
  id: "fetch-articles",
  description: "Fetches full content for each article using Jina Reader",
  
  inputSchema: z.object({
    articles: z.array(z.object({
      title: z.string(),
      url: z.string(),
      hnUrl: z.string(),
    })),
  }),
  
  outputSchema: z.object({
    articlesWithContent: z.array(z.object({
      title: z.string(),
      url: z.string(),
      hnUrl: z.string(),
      content: z.string(),
      success: z.boolean(),
    })),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 2] Fetching article content...', { count: inputData.articles.length });
    
    const articlesWithContent = [];
    
    // Fetch content for each article
    for (const article of inputData.articles) {
      logger?.info('📝 [Step 2] Fetching article', { title: article.title });
      
      const result = await fetchArticleContent.execute({
        context: {
          url: article.url,
          title: article.title,
        },
        runtimeContext,
        mastra,
      });
      
      articlesWithContent.push({
        title: article.title,
        url: article.url,
        hnUrl: article.hnUrl,
        content: result.content,
        success: result.success,
      });
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successCount = articlesWithContent.filter(a => a.success).length;
    logger?.info('✅ [Step 2] Articles fetched', { 
      total: articlesWithContent.length,
      successful: successCount 
    });
    
    return {
      articlesWithContent,
    };
  },
});

/**
 * Step 3: Generate digest using AI
 */
const generateDigestStep = createStep({
  id: "generate-digest",
  description: "Uses AI to analyze articles and generate structured digest",
  
  inputSchema: z.object({
    articlesWithContent: z.array(z.object({
      title: z.string(),
      url: z.string(),
      hnUrl: z.string(),
      content: z.string(),
      success: z.boolean(),
    })),
  }),
  
  outputSchema: z.object({
    topStories: z.string(),
    topStoriesSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
    })),
    learn: z.string(),
    learnSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
    })),
    digDeeper: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    })),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 3] Generating digest with AI...');
    
    // Filter successful articles
    const successfulArticles = inputData.articlesWithContent.filter(a => a.success);
    
    if (successfulArticles.length === 0) {
      throw new Error('No articles were successfully fetched');
    }
    
    // Prepare articles summary for the AI
    const articlesSummary = successfulArticles.map((article, idx) => {
      // Truncate content to reasonable length (first 2000 chars)
      const truncatedContent = article.content.substring(0, 2000);
      return `Article ${idx + 1}:
Title: ${article.title}
URL: ${article.url}
HN Discussion: ${article.hnUrl}
Content Preview:
${truncatedContent}
---`;
    }).join('\n\n');
    
    const prompt = `Analyze the following HackerNews articles and create a digest email with three sections:

${articlesSummary}

Generate a structured digest with:
1. Top Stories section (1-2 paragraphs)
2. Learn section (1-2 paragraphs) 
3. Dig Deeper section (bulleted list)

For the output, provide:
- topStories: The Top Stories section text (1-2 paragraphs)
- topStoriesSources: Array of articles used (title and url)
- learn: The Learn section text (1-2 paragraphs)
- learnSources: Array of articles used (title and url)
- digDeeper: Array of interesting items with title, url, and brief description

Make sure to properly cite sources and create engaging, informative content.`;
    
    const digestSchema = z.object({
      topStories: z.string().describe("1-2 paragraphs about the top stories"),
      topStoriesSources: z.array(z.object({
        title: z.string(),
        url: z.string(),
      })).describe("Articles referenced in top stories"),
      learn: z.string().describe("1-2 paragraphs about educational content"),
      learnSources: z.array(z.object({
        title: z.string(),
        url: z.string(),
      })).describe("Articles referenced in learn section"),
      digDeeper: z.array(z.object({
        title: z.string(),
        url: z.string(),
        description: z.string(),
      })).describe("List of other interesting items to explore"),
    });
    
    const result = await generateDigest(prompt, digestSchema, logger);
    
    logger?.info('✅ [Step 3] Digest generated successfully');
    
    return result;
  },
});

/**
 * Step 4: Convert digest to HTML email
 */
const formatHtmlEmailStep = createStep({
  id: "format-html-email",
  description: "Formats the digest as an HTML email with proper styling",
  
  inputSchema: z.object({
    topStories: z.string(),
    topStoriesSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
    })),
    learn: z.string(),
    learnSources: z.array(z.object({
      title: z.string(),
      url: z.string(),
    })),
    digDeeper: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    })),
  }),
  
  outputSchema: z.object({
    html: z.string(),
    subject: z.string(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 4] Formatting HTML email...');
    
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const subject = `HackerNews Digest - ${today}`;
    
    // Helper function to convert URLs in text to clickable links
    const makeLinksClickable = (text: string) => {
      return text.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" style="color: #ff6600; text-decoration: none;">$1</a>'
      );
    };
    
    // Format sources as inline citations
    const formatSources = (sources: Array<{ title: string; url: string }>) => {
      if (sources.length === 0) return '';
      return '<p style="margin-top: 10px; font-size: 14px; color: #666;"><strong>Sources:</strong> ' + 
        sources.map(s => `<a href="${s.url}" style="color: #ff6600; text-decoration: none;">${s.title}</a>`).join(', ') +
        '</p>';
    };
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
    
    <!-- Header -->
    <div style="border-bottom: 2px solid #ff6600; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; color: #000000; font-size: 24px; font-weight: bold;">
        🗞️ HackerNews Daily Digest
      </h1>
      <p style="margin: 5px 0 0 0; color: #666666; font-size: 14px;">
        ${today}
      </p>
    </div>
    
    <!-- Top Stories Section -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #ff6600; font-size: 20px; margin: 0 0 15px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
        📰 Top Stories
      </h2>
      <div style="color: #000000; font-size: 16px; line-height: 1.6;">
        ${makeLinksClickable(inputData.topStories)}
      </div>
      ${formatSources(inputData.topStoriesSources)}
    </div>
    
    <!-- Learn Section -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #ff6600; font-size: 20px; margin: 0 0 15px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
        📚 Learn
      </h2>
      <div style="color: #000000; font-size: 16px; line-height: 1.6;">
        ${makeLinksClickable(inputData.learn)}
      </div>
      ${formatSources(inputData.learnSources)}
    </div>
    
    <!-- Dig Deeper Section -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #ff6600; font-size: 20px; margin: 0 0 15px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
        🔍 Dig Deeper
      </h2>
      <ul style="color: #000000; font-size: 16px; line-height: 1.8; padding-left: 20px;">
        ${inputData.digDeeper.map(item => `
          <li style="margin-bottom: 10px;">
            <a href="${item.url}" style="color: #ff6600; text-decoration: none; font-weight: 600;">
              ${item.title}
            </a>
            <span style="color: #666666;"> - ${item.description}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999999; font-size: 12px;">
      <p style="margin: 0;">
        This digest was automatically generated from 
        <a href="https://news.ycombinator.com" style="color: #ff6600; text-decoration: none;">HackerNews</a>
      </p>
    </div>
    
  </div>
</body>
</html>`;
    
    logger?.info('✅ [Step 4] HTML email formatted');
    
    return {
      html,
      subject,
    };
  },
});

/**
 * Step 5: Send email via Resend
 */
const sendEmailStep = createStep({
  id: "send-email",
  description: "Sends the digest email using Resend",
  
  inputSchema: z.object({
    html: z.string(),
    subject: z.string(),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [Step 5] Sending email...');
    
    const result = await sendEmailViaResend.execute({
      context: {
        to: 'qiuxinjie@gmail.com',
        subject: inputData.subject,
        html: inputData.html,
      },
      runtimeContext,
      mastra,
    });
    
    if (result.success) {
      logger?.info('✅ [Step 5] Email sent successfully', { messageId: result.messageId });
    } else {
      logger?.error('❌ [Step 5] Failed to send email', { error: result.error });
    }
    
    return result;
  },
});

/**
 * Main Workflow - HackerNews Digest
 */
export const hackerNewsDigestWorkflow = createWorkflow({
  id: "hackernews-digest-workflow",
  description: "Daily HackerNews digest generator and email sender",
  
  inputSchema: z.object({}).passthrough(),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
})
  .then(fetchRssStep)
  .then(fetchArticlesStep)
  .then(generateDigestStep)
  .then(formatHtmlEmailStep)
  .then(sendEmailStep)
  .commit();
