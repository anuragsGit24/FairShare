import { v } from "convex/values";
import { action } from "./_generated/server";
import { Resend } from "resend";

// Action to send email using Resend
export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(args.apiKey);

    try {
      const result = await resend.emails.send({
        from: "FairShare <onboarding@resend.dev>",
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });

      // Resend may return { data, error } without throwing.
      if (result?.error) {
        console.error("Resend API returned error:", result.error);
        return {
          success: false,
          error: result.error.message || "Resend API rejected the email",
        };
      }

      const messageId = result?.data?.id || result?.id;
      if (!messageId) {
        console.error("Resend API returned no message id:", result);
        return {
          success: false,
          error: "Resend did not return a message id",
        };
      }

      console.log("Email sent successfully:", result);

      return { success: true, id: messageId };
    } catch (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
  },
});