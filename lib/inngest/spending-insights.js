import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { inngest } from "./client";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const generateInsightsWithGroq = async (prompt) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful financial analyst. Return valid HTML only, no markdown code fences. ",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq API ${response.status}: ${body}`);
  }

  const data = await response.json();
  const html = data?.choices?.[0]?.message?.content?.trim();
  if (!html) {
    throw new Error("Groq API returned empty content");
  }

  return html;
};

export const spendingInsights = inngest.createFunction(
  { name: "Generate Spending Insights", id: "generate-spending-insights" },
  { cron: "0 8 1 * *" }, // 1st of every month at 8 AM UTC
  async ({ step }) => {
    /* 1. PUll users with expenses this month */
    const users = await step.run("Fetch users with expenses", async () => {
      return await convex.query(api.inngest.getUsersWithExpenses);
    });

    /* 2. For each user, generate insights using GenAI */
    const results = [];

    for (const user of users) {
      // Pull last month expenses (skip if none)
      const expenses = await step.run(`Expenses- ${user._id}`, () =>
        convex.query(api.inngest.getUserMonthlyExpenses, { userId: user._id }),
      );
      if (!expenses?.length) continue;

      // Generate insights using GenAI
      const expenseData = JSON.stringify({
        expenses,
        totalSpent: expenses.reduce((sum, e) => sum + e.amount, 0),
        categories: expenses.reduce((cats, e) => {
          cats[e.category ?? "uncategorised"] =
            (cats[e.category] ?? 0) + e.amount;
          return cats;
        }, {}),
      });

      /* c. Prompt + AI call */
      const prompt = `
        As a financial analyst, review this user's spending data for the past month and provide insightful observations and suggestions.
        Focus on spending patterns, category breakdowns, and actionable advice for better financial management.

        STRICT FORMATTING INSTRUCTIONS:
        - Return only valid, well-structured HTML (no markdown, no code fences).
        - Use <h2> for each main section (Monthly Overview, Top Spending Categories, Unusual Spending Patterns, Saving Opportunities, Recommendations for Next Month).
        - Use <h3> for any sub-sections if needed.
        - Use <ul> and <li> for lists and bullet points.
        - Use <p> for concise paragraphs.
        - Use whitespace and spacing for readability.
        - Make the email visually clean, easy to scan, and professional.
        - Do NOT repeat the user's raw data in the email.
        - Each section should be clear, well-titled, and easy to read.
        - Avoid long blocks of text; break up content with lists and short paragraphs.
        - If Adding a Thank you or closing line keep it strictly from Fairshare dont add any name.
        - Do not repeat any information in multiple sections, each insight should be unique to its section.

        User spending data (for your analysis only, do not include raw data in the email):
        ${expenseData}

        Provide your analysis in these sections (each as a separate <h2>):
        1. Monthly Overview
        2. Top Spending Categories
        3. Unusual Spending Patterns (if any)
        4. Saving Opportunities
        5. Recommendations for Next Month
      `.trim();

      try {
        const htmlBody = await step.run(`Groq - ${user._id}`, async () => {
          return await generateInsightsWithGroq(prompt);
        });

        const emailResult = await step.run(`Email - ${user._id}`, async () => {
          return await convex.action(api.email.sendEmail, {
            to: user.email,
            subject: "Your Monthly Spending Insights from FairShare",
            html: `
              <h1>Your Monthly Spending Insights</h1>
              <p>Hi ${user.name},</p>
              <p>Here's a summary of your spending for the past month:</p>
              ${htmlBody}
            `,
            apiKey: process.env.RESEND_API_KEY,
          });
        });

        if (!emailResult?.success) {
          throw new Error(emailResult?.error || "Email send failed");
        }

        results.push({ userId: user._id, email: user.email, success: true });
      } catch (error) {
        results.push({
          userId: user._id,
          email: user.email,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      processed: results.length,
      success: results.filter((r) => r.success).length,
      failures: results.filter((r) => !r.success).length,
      details: results,
    };
  },
);
