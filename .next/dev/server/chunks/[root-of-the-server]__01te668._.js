module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/app/api/scan/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "maxDuration",
    ()=>maxDuration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$generative$2d$ai$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@google/generative-ai/dist/index.mjs [app-route] (ecmascript)");
;
;
const maxDuration = 60;
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured. Please add it to your .env file.");
    }
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$generative$2d$ai$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GoogleGenerativeAI"](apiKey);
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
async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const textContent = formData.get("text");
        if (!file && !textContent) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "No file or text provided"
            }, {
                status: 400
            });
        }
        let genAI;
        try {
            genAI = getGeminiClient();
        } catch (err) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: err.message
            }, {
                status: 503
            });
        }
        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash"
        });
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
                            data: base64
                        }
                    },
                    SYSTEM_PROMPT
                ]);
            } else if (fileType.startsWith("image/")) {
                result = await model.generateContent([
                    {
                        inlineData: {
                            mimeType: fileType,
                            data: base64
                        }
                    },
                    SYSTEM_PROMPT
                ]);
            } else {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Unsupported file type. Please upload a PDF or image."
                }, {
                    status: 400
                });
            }
        } else {
            result = await model.generateContent([
                `Here is the study text content:\n\n${textContent}\n\n${SYSTEM_PROMPT}`
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
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            title: parsed.title || "Study Set",
            summary: parsed.summary || "",
            cards: parsed.cards
        });
    } catch (error) {
        console.error("Scan error:", error);
        const message = error instanceof Error ? error.message : "Failed to process file";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: message
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__01te668._.js.map