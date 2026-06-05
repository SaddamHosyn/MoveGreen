import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, KeyRound, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  companyNameSchema,
  slugSchema,
  joinCodeSchema,
  optionalDomainSchema,
  friendlyRpcError,
} from "@/lib/validation";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs font-medium text-destructive">{msg}</p>;
}


export const Route = createFileRoute("/_authenticated/company")({ component: CompanyPage });

function CompanyPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me-user", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*, companies(*)").eq("id", user!.id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  if (me?.company_id && me?.companies) {
    return <MyCompany company={me.companies} onChange={() => qc.invalidateQueries()} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Join a company</h1>
        <p className="text-sm text-muted-foreground">Compete with your team — or start a new one.</p>
      </div>
      <Tabs defaultValue="join">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="join">Join with code</TabsTrigger>
          <TabsTrigger value="create">Create company</TabsTrigger>
        </TabsList>
        <TabsContent value="join"><JoinForm onDone={() => qc.invalidateQueries()} /></TabsContent>
        <TabsContent value="create"><CreateForm onDone={() => qc.invalidateQueries()} /></TabsContent>
      </Tabs>
    </div>
  );
}

function JoinForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = joinCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setBusy(true);
    const { error: err } = await supabase.rpc("join_company", { _join_code: parsed.data });
    setBusy(false);
    if (err) return toast.error(friendlyRpcError(err.message));
    toast.success("Joined!");
    onDone();
  };
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display"><KeyRound className="h-5 w-5 text-leaf" /> Enter join code</CardTitle>
        <CardDescription>Ask your company admin for a join code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="code">Join code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); if (error) setError(undefined); }}
              placeholder="ABC123"
              aria-invalid={!!error}
              autoCapitalize="characters"
            />
            <FieldError msg={error} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Joining…" : "Join company"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [errors, setErrors] = useState<{ name?: string; slug?: string; domain?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const np = companyNameSchema.safeParse(name);
    const sp = slugSchema.safeParse(slug);
    const dp = optionalDomainSchema.safeParse(domain);
    if (!np.success) next.name = np.error.issues[0]?.message;
    if (!sp.success) next.slug = sp.error.issues[0]?.message;
    if (!dp.success) next.domain = dp.error.issues[0]?.message;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const { error: err } = await supabase.rpc("create_company", {
      _name: np.data!,
      _public_slug: sp.data!,
      _allowed_email_domain: dp.data ? dp.data : null,
    } as any);
    setBusy(false);
    if (err) return toast.error(friendlyRpcError(err.message));
    toast.success("Company created!");
    onDone();
  };
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display"><Plus className="h-5 w-5 text-leaf" /> New company</CardTitle>
        <CardDescription>You'll become the company admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="cname">Name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
              aria-invalid={!!errors.name}
            />
            <FieldError msg={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cslug">Public slug</Label>
            <Input
              id="cslug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); if (errors.slug) setErrors({ ...errors, slug: undefined }); }}
              placeholder="acme"
              aria-invalid={!!errors.slug}
            />
            <FieldError msg={errors.slug} />
            {!errors.slug && <p className="text-xs text-muted-foreground">Lowercase letters, numbers and dashes. Used in your public URL.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdom">Allowed email domain</Label>
            <Input
              id="cdom"
              value={domain}
              onChange={(e) => {
                const v = e.target.value.trim();
                setDomain(v.includes("@") ? v.split("@").pop() ?? "" : v);
                if (errors.domain) setErrors({ ...errors, domain: undefined });
              }}
              placeholder="acme.com"
              aria-invalid={!!errors.domain}
            />
            <FieldError msg={errors.domain} />
            {!errors.domain && <p className="text-xs text-muted-foreground">Just the domain (e.g. acme.com). Leave blank to allow any email.</p>}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create company"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}


function MyCompany({ company, onChange }: { company: any; onChange: () => void }) {
  const leave = async () => {
    if (!confirm("Leave this company?")) return;
    const { error } = await supabase.rpc("leave_company");
    if (error) toast.error(error.message);
    else { toast.success("Left company"); onChange(); }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">My company</h1>
          <p className="text-sm text-muted-foreground">Your current team.</p>
        </div>
        <Button variant="outline" onClick={leave}><LogOut className="mr-2 h-4 w-4" /> Leave</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display"><Building2 className="h-5 w-5 text-leaf" /> {company.name}</CardTitle>
          <CardDescription>/{company.public_slug}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Total points" value={`${company.total_points ?? 0} pts`} />
            <Info label="Join code" value={company.join_code ?? "—"} mono />
          </div>
          {company.allowed_email_domain && (
            <Info label="Allowed domain" value={`@${company.allowed_email_domain}`} mono />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${mono ? "font-mono" : "font-display"}`}>{value}</p>
    </div>
  );
}
