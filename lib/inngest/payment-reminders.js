import { inngest } from "./client";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export const paymentReminders = inngest.createFunction(
  { id: "send payment reminders" },
  { cron: "0 10 * * *" }, // every day at 9am
  async ({ step }) => {
    //1. fetch all user that still owe money
    const users = await step.run("fetch-debts", () =>
      convex.query(api.inngest.getUsersWithOutStandingDebts),
    );
    const result = await step.run("send-emails", async () => {
      return Prommise.all(
        users.map(async (u) => {
          const rows = u.debts
            .map(
              (d) => `<tr>
                <td style="padding:4px 8px">${d.name}</td>
                <td style="padding:4px 8px">${d.amount.toFixed(2)}</td>
              </tr>
             `,
            )
            .join("");

            if(!rows) return {userId : u._id, success: true}; // skip users with no debts

            const html = `
              <h2>FaiShare - Payment Reminder</h2>
              <p>Hi ${u.name}, you have the following outstanding balances:</p>
              <table cellspacing="0" cellpadding="0" border="1" style="border-collapse: collapse;">
                <thead>
                  <tr>
                    <th>To</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
              <p>Please log in to your FairShare account to settle these balances.</p>
            `;

            
        }),
      );
    });
  },
);
