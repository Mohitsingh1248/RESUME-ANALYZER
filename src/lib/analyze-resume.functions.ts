import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const AnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).min(1).max(8),
  weaknesses: z.array(z.string()).min(1).max(8),
  suggestions: z.array(z.string()).min(1).max(8),
});

const InputSchema = z.object({
  fileName: z.string().min(1).max(255),
  text: z.string().min(50).max(50000),
});

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { experimental_output } = await generateText({
      model,
      experimental_output: Output.object({ schema: AnalysisSchema }),
      system:
        "You are a senior technical recruiter and resume coach. Analyze resumes critically and return concise, actionable feedback. Score 0-100 based on clarity, impact, relevance, formatting, and quantified achievements.",
      prompt: `Analyze the following resume and return a structured assessment.\n\nResume text:\n"""\n${data.text}\n"""`,
    });

    const analysis = experimental_output;
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
