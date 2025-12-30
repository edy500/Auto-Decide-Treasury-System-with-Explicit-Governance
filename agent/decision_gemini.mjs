import { GoogleGenerativeAI } from "@google/generative-ai";

function safeJsonParse(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini response does not contain valid JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function decideWithGemini(context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY in .env");

  const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });



  const prompt = `
You are an autonomous treasury & billing agent operating with USDC and USYC.

Return STRICT JSON ONLY (no markdown, no extra text).

Allowed actions:
- ALLOCATE: move USDC -> USYC (allocate idle funds)
- DEALLOCATE: move USYC -> USDC (restore liquidity)
- HOLD: do nothing

Constraints:
- Keep USDC >= policy.MIN_USDC_BUFFER after the action
- Never allocate more than policy.MAX_ALLOC_PCT of excess USDC
- amount_usdc must be >= 0
- If action is HOLD, amount_usdc must be 0

Output JSON format:
{
  "action": "ALLOCATE" | "DEALLOCATE" | "HOLD",
  "usdc_target": number,
  "amount_usdc": number,
  "reason": string
}

Context:
${JSON.stringify(context, null, 2)}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const decision = safeJsonParse(text);

  // validação mínima
  const allowed = new Set(["ALLOCATE", "DEALLOCATE", "HOLD"]);
  if (!allowed.has(decision.action)) throw new Error("Invalid action from Gemini.");
  if (typeof decision.amount_usdc !== "number") throw new Error("amount_usdc must be a number.");
  if (typeof decision.usdc_target !== "number") throw new Error("usdc_target must be a number.");
  if (typeof decision.reason !== "string") throw new Error("reason must be a string.");
  if (decision.action === "HOLD" && decision.amount_usdc !== 0) {
    throw new Error("HOLD must have amount_usdc = 0.");
  }

  return decision;
}
