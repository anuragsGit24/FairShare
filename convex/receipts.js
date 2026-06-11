"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

function normalizeToDataUrl(imageData) {
  if (!imageData) return "";
  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    return imageData;
  }
  if (imageData.startsWith("data:image/")) {
    return imageData;
  }
  return `data:image/jpeg;base64,${imageData}`;
}

function extractJsonArray(text) {
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    throw new Error("LLM response did not contain a JSON array");
  }
  return text.slice(firstBracket, lastBracket + 1);
}

function validateItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Parsed output is not an array");
  }

  return items.map((it) => {
    if (!it || typeof it.name !== "string") {
      throw new Error("Invalid item shape from LLM");
    }
    const price = Number(it.price);
    if (!Number.isFinite(price)) {
      throw new Error("Invalid price in LLM output");
    }
    return { name: it.name.trim(), price };
  });
}

// Action: scanReceipt
// Accepts either a data URL / base64 string or an accessible image URL in `imageData`.
// Returns an array of { name: string, price: number } parsed from the receipt.
export const scanReceipt = action({
  args: {
    imageData: v.string(), // base64 data or a public URL
  },
  handler: async (_ctx, { imageData }) => {
    // Strict system prompt according to spec
    const systemPrompt =
      "You are an expert receipt parser. Extract all line items and their exact prices from this image. Return ONLY a valid JSON array of objects with the exact shape: [{ \"name\": \"string\", \"price\": number }]. Do not include markdown formatting or backticks.";

    const imageUrlOrData = normalizeToDataUrl(imageData);

    try {
      // Prefer OpenAI when OPENAI_API_KEY exists, otherwise use Gemini.
      if (process.env.OPENAI_API_KEY) {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Parse this receipt image and return JSON only." },
                { type: "image_url", image_url: { url: imageUrlOrData } },
              ],
            },
          ],
          temperature: 0,
        });

        const textOutput = completion.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(extractJsonArray(textOutput));
        return validateItems(parsed);
      }

      if (process.env.GEMINI_API_KEY) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const candidateModels = [
          "gemini-3.0-flash",
          "gemini-3.5-flash-latest",
          "gemini-3.5-flash",
        ];

        let lastModelError = null;

        for (const modelName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });

            let resultText = "";
            if (imageUrlOrData.startsWith("data:image/")) {
              const match = imageUrlOrData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
              if (!match) {
                throw new Error("Invalid base64 image format");
              }
              const mimeType = match[1];
              const base64 = match[2];

              const result = await model.generateContent([
                systemPrompt,
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ]);
              resultText = result.response.text();
            } else {
              const result = await model.generateContent([
                systemPrompt,
                `Receipt image URL: ${imageUrlOrData}`,
              ]);
              resultText = result.response.text();
            }

            const parsed = JSON.parse(extractJsonArray(resultText));
            return validateItems(parsed);
          } catch (modelErr) {
            lastModelError = modelErr;
            // Try next model name for 404/unsupported model errors.
            continue;
          }
        }

        throw lastModelError || new Error("All Gemini model attempts failed");
      }

      throw new Error("Missing OPENAI_API_KEY or GEMINI_API_KEY in environment variables");
    } catch (err) {
      console.error("scanReceipt error:", err);
      throw new Error(err.message || "Failed to analyze receipt");
    }
  },
});
