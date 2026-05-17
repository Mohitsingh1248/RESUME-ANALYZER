import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertTriangle, Lightbulb, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/analysis/$id")({
  component: AnalysisPage,
});

type Row = {
  id: string;
  file_name: string;
  score: number;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  created_at: string;
};

function AnalysisPage() {
  const { id } = useParams({ from: "/_app/analysis/$id" });
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("resume_analyses")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setData(data as unknown as Row);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <Card className="glass p-10 text-center">
        <p className="text-muted-foreground">Analysis not found.</p>
        <Link to="/dashboard"><Button variant="outline" className="mt-4">Back to dashboard</Button></Link>
      </Card>
    );
  }

  const scoreColor =
    data.score >= 80 ? "text-success" : data.score >= 60 ? "text-warning" : "text-destructive";
  const ringColor =
    data.score >= 80 ? "oklch(0.72 0.18 155)" : data.score >= 60 ? "oklch(0.80 0.17 80)" : "oklch(0.65 0.22 25)";

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{data.file_name}</h1>
      </div>

      <Card className="glass-strong overflow-hidden rounded-2xl p-8 shadow-elevated">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative flex flex-col items-center gap-8 sm:flex-row">
          <div
            className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full animate-scale-in"
            style={{
              background: `conic-gradient(${ringColor} ${data.score * 3.6}deg, oklch(0.24 0.025 270) 0deg)`,
            }}
          >
            <div className="flex h-[124px] w-[124px] flex-col items-center justify-center rounded-full bg-card glass">
              <span className={`text-4xl font-bold ${scoreColor}`}>{data.score}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">out of 100</span>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold">Resume score</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Strengths"
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          items={data.strengths}
          accent="success"
          delayClass="animate-stagger-2"
        />
        <Section
          title="Weaknesses"
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          items={data.weaknesses}
          accent="destructive"
          delayClass="animate-stagger-3"
        />
      </div>

      <Section
        title="Suggestions"
        icon={<Lightbulb className="h-5 w-5 text-accent" />}
        items={data.suggestions}
        accent="accent"
        delayClass="animate-stagger-4"
      />
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  accent,
  delayClass,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  accent: "success" | "destructive" | "accent";
  delayClass: string;
}) {
  const dot =
    accent === "success" ? "bg-success" : accent === "destructive" ? "bg-destructive" : "bg-accent";
  const glow =
    accent === "success" ? "shadow-[0_0_30px_-8px_oklch(0.72_0.18_155_/_0.4)]" : accent === "destructive" ? "shadow-[0_0_30px_-8px_oklch(0.65_0.22_25_/_0.4)]" : "shadow-[0_0_30px_-8px_oklch(0.78_0.18_200_/_0.4)]";
  return (
    <Card className={`glass overflow-hidden rounded-xl p-6 transition-all duration-500 hover:shadow-card-hover ${delayClass} ${glow}`}>
      <div className="mb-5 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed animate-stagger-1" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
