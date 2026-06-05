import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { emailSchema, passwordSchema, nameSchema, friendlyAuthError } from "@/lib/validation";

export const Route = createFileRoute("/auth")({ ssr: false, component: AuthPage });

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-semibold">GreenGo</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Welcome</CardTitle>
            <CardDescription>Sign in or create an account to start earning points.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs font-medium text-destructive">{msg}</p>;
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const ep = emailSchema.safeParse(email);
    if (!ep.success) next.email = ep.error.issues[0]?.message;
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: ep.success ? ep.data : email.trim(),
      password,
    });
    setBusy(false);
    if (error) toast.error(friendlyAuthError(error.message));
    else toast.success("Welcome back!");
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input
          id="si-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
          aria-invalid={!!errors.email}
        />
        <FieldError msg={errors.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="si-pass">Password</Label>
        <Input
          id="si-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
          aria-invalid={!!errors.password}
        />
        <FieldError msg={errors.password} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const np = nameSchema.safeParse(name);
    const ep = emailSchema.safeParse(email);
    const pp = passwordSchema.safeParse(password);
    if (!np.success) next.name = np.error.issues[0]?.message;
    if (!ep.success) next.email = ep.error.issues[0]?.message;
    if (!pp.success) next.password = pp.error.issues[0]?.message;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: ep.data!,
      password: pp.data!,
      options: {
        data: { name: np.data! },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setBusy(false);
    if (error) toast.error(friendlyAuthError(error.message));
    else toast.success("Account created! Check your email if confirmation is required.");
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Name</Label>
        <Input
          id="su-name"
          autoComplete="name"
          value={name}
          onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
          aria-invalid={!!errors.name}
        />
        <FieldError msg={errors.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input
          id="su-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
          aria-invalid={!!errors.email}
        />
        <FieldError msg={errors.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pass">Password</Label>
        <Input
          id="su-pass"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
          aria-invalid={!!errors.password}
        />
        <FieldError msg={errors.password} />
        {!errors.password && <p className="text-xs text-muted-foreground">At least 6 characters.</p>}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
    </form>
  );
}
