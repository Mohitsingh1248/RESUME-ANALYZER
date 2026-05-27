import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useServerFn } from "@tanstack/react-start";
import { extractPdfText } from "@/lib/pdf-extract";
import { analyzeResume } from "@/lib/analyze-resume.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, Trash2, Sparkles, TrendingUp, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Stage = "idle" | "reading" | "extracting" | "analyzing" | "saving" | "done";

const STAGE_META: Record<Exclude<Stage, "idle">, { label: string; target: number }> = {
  reading: { label: "Reading file", target: 15 },
  extracting: { label: "Extracting text from PDF", target: 40 },
  analyzing: { label: "Analyzing with AI", target: 85 },
  saving: { label: "Saving results", target: 95 },
  done: { label: "Complete", target: 100 },
};

const STAGE_ORDER: Exclude<Stage, "idle">[] = ["reading", "extracting", "analyzing", "saving", "done"];

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type Analysis = {
  id: string;
  file_name: string;
  score: number;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const runAnalyze = useServerFn(analyzeResume);
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("resume_analyses")
      .select("id, file_name, score, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setHistory(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const advanceTo = useCallback((next: Exclude<Stage, "idle">) => {
    setStage(next);
    const target = STAGE_META[next].target;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= target) return p;
        const delta = Math.max(0.4, (target - p) * 0.08);
        return Math.min(target, p + delta);
      });
    }, 200);
  }, []);

  const stopTicking = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTicking(), [stopTicking]);

  const canceledRef = useRef(false);

  const resetUi = useCallback(() => {
    stopTicking();
    setAnalyzing(false);
    setStage("idle");
    setProgress(0);
    setFileName("");
  }, [stopTicking]);

  const handleCancel = useCallback(() => {
    canceledRef.current = true;
    resetUi();
    toast.message("Analysis canceled");
  }, [resetUi]);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large (max 10MB)");
        return;
      }
      canceledRef.current = false;
      setAnalyzing(true);
      setFileName(file.name);
      setProgress(0);
      advanceTo("reading");
      try {
        advanceTo("extracting");
        const text = await extractPdfText(file);
        if (canceledRef.current) return;
        if (text.length < 50) throw new Error("Couldn't read text from this PDF");
        advanceTo("analyzing");
        const result = await runAnalyze({ data: { fileName: file.name, text: text.slice(0, 50000) } });
        if (canceledRef.current) return;
        advanceTo("saving");
        stopTicking();
        setProgress(100);
        setStage("done");
        toast.success(`Analysis complete — score ${result.score}`);
        navigate({ to: "/analysis/$id", params: { id: result.id } });
      } catch (err) {
        if (canceledRef.current) return;
        const msg = err instanceof Error ? err.message : "Analysis failed";
        toast.error(msg);
      } finally {
        if (!canceledRef.current) {
          resetUi();
        }
      }
    },
    [runAnalyze, navigate, advanceTo, stopTicking, resetUi],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: analyzing,
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("resume_analyses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      setHistory((h) => h.filter((a) => a.id !== id));
      toast.success("Deleted");
    }
  };

  return (
    <div className="space-y-10">
      <section className="animate-fade-in-up">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Get instant <span className="text-gradient">AI feedback</span> on your resume
        </h1>
        <p className="mt-3 text-muted-foreground">Drop a PDF below — we'll score it and give actionable insights.</p>
      </section>

      <Card className="glass-strong animate-stagger-1 overflow-hidden rounded-2xl p-2 shadow-elevated">
        <div
          {...getRootProps()}
          className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all duration-500 ${
            isDragActive
              ? "border-primary/60 bg-primary/5 scale-[1.01]"
              : "border-border/50 hover:border-primary/40 hover:bg-primary/[0.03]"
          } ${analyzing ? "cursor-default" : ""}`}
        >

          <input {...getInputProps()} />
          {analyzing ? (
            <div className="w-full max-w-md space-y-5 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{fileName || "Processing…"}</p>
                  <p className="text-xs text-muted-foreground">
                    {stage !== "idle" ? STAGE_META[stage].label : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-left sm:grid-cols-4">
                {STAGE_ORDER.filter((s) => s !== "done").map((s) => {
                  const currentIdx = stage === "idle" ? -1 : STAGE_ORDER.indexOf(stage);
                  const sIdx = STAGE_ORDER.indexOf(s);
                  const isDone = currentIdx > sIdx;
                  const isActive = currentIdx === sIdx;
                  return (
                    <li
                      key={s}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                        isDone
                          ? "text-success"
                          : isActive
                            ? "text-primary"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                      <span className="truncate">{STAGE_META[s].label}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">This usually takes 10-20 seconds</p>
            </div>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow animate-float">
                <Upload className="h-7 w-7 text-primary-foreground" />
              </div>
              <p className="mt-5 text-lg font-medium">
                {isDragActive ? "Drop your resume here" : "Drag & drop your resume PDF"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse — max 10MB</p>
              <Button type="button" className="mt-6 bg-gradient-primary text-primary-foreground hover:opacity-90 animate-pulse-glow rounded-xl">
                <Sparkles className="mr-2 h-4 w-4" /> Choose file
              </Button>
            </>
          )}
        </div>
      </Card>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Recent analyses</h2>
          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{history.length}</span>
        </div>
        {history.length === 0 ? (
          <Card className="glass animate-stagger-3 p-10 text-center text-sm text-muted-foreground">
            No analyses yet. Upload your first resume above.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((a, i) => (
              <Card
                key={a.id}
                className={`glass group relative overflow-hidden rounded-xl p-5 transition-all duration-500 hover:shadow-card-hover hover:scale-[1.02] hover:border-primary/30 animate-stagger-${Math.min(i + 1, 5)}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <Link to="/analysis/$id" params={{ id: a.id }} className="relative block">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary transition-colors group-hover:bg-primary/20">
                      <FileText className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium transition-colors group-hover:text-primary">{a.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ScoreBadge score={a.score} />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="absolute right-3 top-3 hidden rounded-md p-1.5 text-muted-foreground opacity-0 transition-all duration-300 hover:bg-destructive/10 hover:text-destructive group-hover:block group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";
  const bg =
    score >= 80 ? "bg-success/10" : score >= 60 ? "bg-warning/10" : "bg-destructive/10";
  return (
    <div className={`shrink-0 rounded-xl ${bg} px-3 py-1.5 text-center transition-transform duration-300 hover:scale-105`}>
      <div className={`text-xl font-semibold leading-none ${color}`}>{score}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">/100</div>
    </div>
  );
}
