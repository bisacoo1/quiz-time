import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add it to your .env file.");
  }
  return new GoogleGenerativeAI(apiKey);
}

const SYSTEM_PROMPT = `You are a smart study assistant. Analyze the provided content (from a PDF or image) and generate high-quality flashcard quiz questions.

Your task:
1. Extract the key concepts, facts, definitions, formulas, and important information from the content.
2. Generate between 8 and 20 flashcard questions depending on the content length.
3. Make questions clear, educational, and varied (definitions, explanations, comparisons, etc.).
4. Provide concise but complete answers.
5. Add helpful hints where appropriate.
6. Rate each card difficulty as "easy", "medium", or "hard".

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "title": "A descriptive title for this study set (max 60 chars)",
  "summary": "Brief 1-2 sentence summary of what was studied",
  "cards": [
    {
      "question": "Question text here?",
      "answer": "Complete answer here",
      "hint": "Optional hint (or empty string)",
      "difficulty": "easy|medium|hard"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;

    if (!file && !textContent) {
      return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
    }

    let genAI: ReturnType<typeof getGeminiClient>;
    try {
      genAI = getGeminiClient();
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 503 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    let result;

    if (file) {
      const fileType = file.type;
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      if (fileType === "application/pdf") {
        // For PDF, use the document API
        result = await model.generateContent([
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64,
            },
          },
          SYSTEM_PROMPT,
        ]);
      } else if (fileType.startsWith("image/")) {
        result = await model.generateContent([
          {
            inlineData: {
              mimeType: fileType as "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif",
              data: base64,
            },
          },
          SYSTEM_PROMPT,
        ]);
      } else {
        return NextResponse.json({ error: "Unsupported file type. Please upload a PDF or image." }, { status: 400 });
      }
    } else {
      result = await model.generateContent([
        `Here is the study text content:\n\n${textContent}\n\n${SYSTEM_PROMPT}`,
      ]);
    }

    const responseText = result.response.text();

    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      throw new Error("No flashcards were generated from this content");
    }

    return NextResponse.json({
      success: true,
      title: parsed.title || "Study Set",
      summary: parsed.summary || "",
      cards: parsed.cards,
    });
  } catch (error) {
    console.error("Scan error:", error);
    const message = error instanceof Error ? error.message : "Failed to process file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
