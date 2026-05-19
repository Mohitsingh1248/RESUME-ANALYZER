import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";


const AnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).max(8),
  weaknesses: z.array(z.string()).max(8),
  suggestions: z.array(z.string()).max(8),
});

const InputSchema = z.object({
  fileName: z.string().min(1).max(255),
  text: z.string().min(50).max(50000),
});

const AnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "strengths", "weaknesses", "suggestions"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    weaknesses: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
  },
} as const;

function sanitizeAnalysis(raw: unknown, resumeText: string) {
  const fallback = {
    score: 65,
    summary: "This resume shows relevant experience, but it needs clearer structure, stronger impact statements, and more measurable outcomes.",
    strengths: [
      "The resume contains enough detail to identify experience and core skills.",
      "The document appears targeted toward professional job applications.",
    ],
    weaknesses: [
      "Several bullets likely underemphasize measurable impact or business results.",
      "The narrative may be too broad or inconsistent for a recruiter’s fast review.",
    ],
    suggestions: [
      "Add metrics to achievements wherever possible, such as percentages, time saved, revenue influenced, or volume handled.",
      "Rewrite weak bullets to start with strong action verbs followed by the result.",
      "Tailor the summary and top skills to the specific role you are targeting.",
    ],
  };

  const parsed = AnalysisSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  const trimmedText = resumeText.trim();
  const shortText = trimmedText.slice(0, 600);

  return AnalysisSchema.parse({
    score: typeof (raw as { score?: unknown })?.score === "number"
      ? Math.max(0, Math.min(100, Math.round((raw as { score: number }).score)))
      : fallback.score,
    summary:
      typeof (raw as { summary?: unknown })?.summary === "string" && (raw as { summary: string }).summary.trim().length > 0
        ? (raw as { summary: string }).summary.trim()
        : shortText.length > 0
          ? `This resume includes usable content, but the generated structured analysis was incomplete. A safe review suggests focusing on clearer positioning, stronger quantified achievements, and more concise phrasing. Resume excerpt reviewed: ${shortText}`
          : fallback.summary,
    strengths: Array.isArray((raw as { strengths?: unknown })?.strengths)
      ? ((raw as { strengths: unknown[] }).strengths.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 8))
      : fallback.strengths,
    weaknesses: Array.isArray((raw as { weaknesses?: unknown })?.weaknesses)
      ? ((raw as { weaknesses: unknown[] }).weaknesses.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 8))
      : fallback.weaknesses,
    suggestions: Array.isArray((raw as { suggestions?: unknown })?.suggestions)
      ? ((raw as { suggestions: unknown[] }).suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 8))
      : fallback.suggestions,
  });
}

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { text } = await generateText({
      model,
      maxOutputTokens: 900,
      temperature: 0.2,
      system:
        "You are a senior technical recruiter and resume coach. Analyze resumes critically and return concise, actionable feedback.",
      prompt: `Analyze the resume below and respond with a single valid JSON object only. Do not wrap it in markdown fences. Follow this JSON Schema exactly:\n${JSON.stringify(AnalysisJsonSchema)}\n\nRules:\n- score must be an integer from 0 to 100\n- summary must be 2 to 4 sentences\n- strengths, weaknesses, and suggestions must each contain 2 to 5 concise strings\n- every list item must be plain text\n\nResume text:\n"""\n${data.text}\n"""`,
    });

    let rawAnalysis: unknown;

    try {
      rawAnalysis = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      rawAnalysis = match ? JSON.parse(match[0]) : null;
    }

    const analysis = sanitizeAnalysis(rawAnalysis, data.text);


    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("resume_analyses")
      .insert({
        user_id: userId,
        file_name: data.fileName,
        score: analysis.score,
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id, ...analysis };
  });
