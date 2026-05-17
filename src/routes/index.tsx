import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FileSearch, Sparkles, ShieldCheck, Zap, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "ResumeIQ — AI Resume Analyzer" },
      { name: "description", content: "Drop your resume and get an instant AI-powered score, strengths, weaknesses, and suggestions to land your next role." },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <FileSearch className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">ResumeIQ</span>
        </Link>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center sm:py-28">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Powered by Lovable AI
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Your resume, <span className="text-gradient">scored by AI</span> in seconds.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Upload a PDF and get an honest score, strengths, weaknesses, and concrete suggestions to land more interviews.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                Analyze my resume <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 sm:grid-cols-3">
          <Feature icon={<Zap className="h-5 w-5" />} title="Instant insights" body="From PDF to detailed report in under 20 seconds." />
          <Feature icon={<Sparkles className="h-5 w-5" />} title="Actionable suggestions" body="Specific edits to strengthen impact and clarity." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Private & secure" body="Your resume stays linked to your account only." />
        </section>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-gradient-card rounded-xl border border-border/60 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
