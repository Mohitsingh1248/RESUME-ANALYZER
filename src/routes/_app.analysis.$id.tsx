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
      <Card className="bg-gradient-card border-border/60 p-10 text-center">
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
    <div className="space-y-8">
      <div>
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{data.file_name}</h1>
      </div>

      <Card className="bg-gradient-card border-border/60 p-8 shadow-elevated">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div
            className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${ringColor} ${data.score * 3.6}deg, oklch(0.28 0.025 270) 0deg)`,
            }}
          >
            <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full bg-card">
              <span className={`text-3xl font-semibold ${scoreColor}`}>{data.score}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">out of 100</span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Resume score</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.summary}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Strengths"
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          items={data.strengths}
          accent="success"
        />
        <Section
          title="Weaknesses"
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          items={data.weaknesses}
          accent="destructive"
        />
      </div>

      <Section
        title="Suggestions"
        icon={<Lightbulb className="h-5 w-5 text-accent" />}
        items={data.suggestions}
        accent="accent"
      />
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  accent: "success" | "destructive" | "accent";
}) {
  const dot =
    accent === "success" ? "bg-success" : accent === "destructive" ? "bg-destructive" : "bg-accent";
  return (
    <Card className="bg-gradient-card border-border/60 p-6">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
