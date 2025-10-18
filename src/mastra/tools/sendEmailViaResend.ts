import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Tool to send emails using Resend
 */
export const sendEmailViaResend = createTool({
  id: "send-email-via-resend",
  description: "Sends an HTML email using the Resend email service",
  
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    html: z.string().describe("HTML content of the email"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    
    logger?.info('🔧 [sendEmailViaResend] Starting execution', { 
      to: context.to,
      subject: context.subject 
    });
    
    try {
      // Get Resend connection from environment
      const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
      const xReplitToken = process.env.REPL_IDENTITY
        ? "repl " + process.env.REPL_IDENTITY
        : process.env.WEB_REPL_RENEWAL
          ? "depl " + process.env.WEB_REPL_RENEWAL
          : null;

      if (!xReplitToken || !hostname) {
        throw new Error("Resend connection not configured properly");
      }

      logger?.info('📝 [sendEmailViaResend] Fetching Resend connection settings...');

      // Fetch connection settings
      const res = await fetch(
        "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
        {
          headers: {
            Accept: "application/json",
            X_REPLIT_TOKEN: xReplitToken,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch Resend connection: ${res.status} ${res.statusText}`);
      }

      const resJson = await res.json();
      const connectionSettings = resJson?.items?.[0];

      if (!connectionSettings || !connectionSettings.settings.api_key) {
        throw new Error("Resend API key not found in connection settings");
      }

      const resendApiKey = connectionSettings.settings.api_key;
      const fromEmail = connectionSettings.settings.from_email || "onboarding@resend.dev";

      logger?.info('📝 [sendEmailViaResend] Sending email via Resend API...');

      // Send email using Resend API
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: context.to,
          subject: context.subject,
          html: context.html,
        }),
      });

      const emailResult = await emailResponse.json();

      if (!emailResponse.ok) {
        logger?.error('❌ [sendEmailViaResend] Failed to send email', { 
          status: emailResponse.status,
          error: emailResult 
        });
        
        return {
          success: false,
          error: emailResult.message || `Failed to send email: ${emailResponse.status}`,
        };
      }

      logger?.info('✅ [sendEmailViaResend] Email sent successfully', { 
        messageId: emailResult.id 
      });

      return {
        success: true,
        messageId: emailResult.id,
      };
      
    } catch (error) {
      logger?.error('❌ [sendEmailViaResend] Error occurred', { error });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
