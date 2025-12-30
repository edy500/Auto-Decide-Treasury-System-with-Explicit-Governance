import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function main() {
  try {
    const res = await genAI.listModels();
    const models = res.models || [];

    console.log("\n=== Available models for this API key ===\n");

    if (models.length === 0) {
      console.log("No models returned.");
      return;
    }

    for (const m of models) {
      const name = m.name;
      const methods = (m.supportedGenerationMethods || []).join(", ");
      console.log(`${name}  |  methods: ${methods}`);
    }

    console.log(
      "\n👉 Pick a model that includes 'generateContent' in supported methods.\n"
    );
  } catch (err) {
    console.error("❌ listModels error:", err.message || err);
  }
}

main();
