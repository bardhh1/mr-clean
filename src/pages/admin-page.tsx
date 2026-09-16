import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/form";
import {
  authorizeAdminMfaEnrollment,
  getSessionUser,
  signInAdmin,
  signOutAdmin,
  verifyAdminMfa
} from "@/lib/admin";
import type { AdminUser, MfaChallenge } from "@/lib/admin";
import { ApiError, hasApiConfig } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Email nuk është valid."),
  password: z.string().min(12, "Fjalëkalimi duhet të ketë së paku 12 karaktere.")
});

const mfaSchema = z.object({
  code: z.string().trim().regex(
    /^(?:\d{6}|[A-Za-z2-7]{4}(?:-[A-Za-z2-7]{4}){3})$/,
    "Shkruani kodin 6-shifror ose një kod rikuperimi."
  )
});

const bootstrapSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, "Shkruani tokenin njëpërdorimësh të operatorit.")
});

type LoginValues = z.infer<typeof loginSchema>;
type MfaValues = z.infer<typeof mfaSchema>;
type BootstrapValues = z.infer<typeof bootstrapSchema>;

export function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCodesAcknowledged, setRecoveryCodesAcknowledged] = useState(false);
  const [recoveryCodeUsed, setRecoveryCodeUsed] = useState(false);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const mfaForm = useForm<MfaValues>({ resolver: zodResolver(mfaSchema) });
  const bootstrapForm = useForm<BootstrapValues>({ resolver: zodResolver(bootstrapSchema) });

  useEffect(() => {
    let cancelled = false;
    getSessionUser()
      .then((sessionUser) => {
        if (!cancelled) setUser(sessionUser);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught, "Administrata nuk u ngarkua."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(values: LoginValues) {
    setError(null);
    try {
      const challenge = await signInAdmin(values.email, values.password);
      setMfaChallenge(challenge);
      mfaForm.reset();
    } catch (caught) {
      setError(errorMessage(caught, "Kyçja dështoi."));
    }
  }

  async function verifyMfa(values: MfaValues) {
    if (!mfaChallenge) return;
    setError(null);
    try {
      const result = await verifyAdminMfa(mfaChallenge.challengeToken, values.code);
      setUser(result.user);
      setMfaChallenge(null);
      setRecoveryCodes(result.recovery_codes ?? []);
      setRecoveryCodesAcknowledged(false);
      setRecoveryCodeUsed(result.used_recovery_code);
      mfaForm.reset();
    } catch (caught) {
      setError(errorMessage(caught, "Verifikimi dështoi."));
    }
  }

  async function authorizeBootstrap(values: BootstrapValues) {
    if (!mfaChallenge || mfaChallenge.mode !== "bootstrap") return;
    setError(null);
    try {
      const enrollment = await authorizeAdminMfaEnrollment(mfaChallenge.challengeToken, values.token);
      setMfaChallenge(enrollment);
      bootstrapForm.reset();
      mfaForm.reset();
    } catch (caught) {
      setError(errorMessage(caught, "Autorizimi i regjistrimit dështoi."));
    }
  }

  async function logout() {
    setError(null);
    try {
      await signOutAdmin();
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 401)) {
        setError(errorMessage(caught, "Dalja dështoi."));
        return;
      }
    }
    resetAuthenticatedState();
  }

  function resetAuthenticatedState() {
    setUser(null);
    setMfaChallenge(null);
    setRecoveryCodes([]);
    setRecoveryCodesAcknowledged(false);
    setRecoveryCodeUsed(false);
    loginForm.reset();
  }

  if (!hasApiConfig) {
    return <section className="page-shell min-h-[64dvh]"><EmptyState icon={ShieldAlert} title="Administrata kërkon API-në" description="Vendos VITE_API_BASE_URL në .env për të lidhur panelin me NestJS dhe Railway." /></section>;
  }

  if (loading) {
    return <section className="page-shell min-h-[64dvh]" role="status"><span className="sr-only">Duke ngarkuar administratën</span><div className="surface h-96 animate-pulse bg-muted" /></section>;
  }

  if (user && recoveryCodes.length > 0) {
    return (
      <AuthShell>
        <Card className="w-full max-w-xl border-white/10 shadow-lift">
          <CardHeader><ShieldCheck className="mb-4 h-10 w-10 text-primary" aria-hidden="true" /><CardTitle className="text-2xl">Ruani kodet e rikuperimit</CardTitle><CardDescription>Këto kode shfaqen vetëm një herë. Ruajini jashtë kësaj pajisjeje dhe mos i dërgoni me email apo mesazhe.</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-1 gap-2 border bg-background/80 p-4 font-mono text-sm sm:grid-cols-2">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
            <label className="flex min-h-11 items-start gap-3 text-sm font-medium"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={recoveryCodesAcknowledged} onChange={(event) => setRecoveryCodesAcknowledged(event.target.checked)} />I kam ruajtur të gjitha kodet jashtë kësaj pajisjeje.</label>
            <Button disabled={!recoveryCodesAcknowledged} onClick={() => setRecoveryCodes([])}>Vazhdo në administratë</Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (!user && mfaChallenge?.mode === "bootstrap") {
    return (
      <AuthShell>
        <Card className="w-full max-w-md border-white/10 shadow-lift">
          <CardHeader><ShieldCheck className="mb-4 h-10 w-10 text-primary" aria-hidden="true" /><CardTitle className="text-2xl">Autorizo aktivizimin e MFA-së</CardTitle><CardDescription>Shkruani tokenin njëpërdorimësh të krijuar në mjedisin e sigurt të Railway. Fjalëkalimi vetëm nuk mund ta regjistrojë authenticator-in.</CardDescription></CardHeader>
          <CardContent><form className="grid gap-4" onSubmit={bootstrapForm.handleSubmit(authorizeBootstrap)}><Field label="Tokeni njëpërdorimësh" error={bootstrapForm.formState.errors.token?.message}><Input type="password" autoComplete="off" spellCheck={false} {...bootstrapForm.register("token")} /></Field><AuthError message={error} /><Button type="submit" size="lg" className="w-full" disabled={bootstrapForm.formState.isSubmitting}>{bootstrapForm.formState.isSubmitting ? "Duke autorizuar…" : "Autorizo dhe vazhdo"}</Button><Button type="button" variant="ghost" onClick={() => { setMfaChallenge(null); setError(null); bootstrapForm.reset(); }}>Fillo përsëri</Button></form></CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (!user && mfaChallenge) {
    const enrollment = mfaChallenge.mode === "enroll" && mfaChallenge.setup;
    return (
      <AuthShell>
        <Card className="w-full max-w-md border-white/10 shadow-lift">
          <CardHeader><KeyRound className="mb-4 h-10 w-10 text-primary" aria-hidden="true" /><CardTitle className="text-2xl">{enrollment ? "Aktivizo verifikimin me dy hapa" : "Shkruaj kodin e sigurisë"}</CardTitle><CardDescription>{enrollment ? "Shto llogarinë në aplikacionin authenticator, pastaj shkruaj kodin 6-shifror." : "Përdor kodin nga authenticator-i ose një kod rikuperimi njëpërdorimësh."}</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            {enrollment ? <div className="grid gap-3 border bg-background/80 p-4 text-sm"><p className="font-medium">Çelësi manual</p><code className="break-all bg-muted p-3 font-mono tracking-wider">{mfaChallenge.setup?.secret}</code><a className="font-semibold text-primary underline underline-offset-4" href={mfaChallenge.setup?.otpauthUri}>Hape në aplikacionin authenticator</a></div> : null}
            <form className="grid gap-4" onSubmit={mfaForm.handleSubmit(verifyMfa)}><Field label="Kodi i sigurisë" error={mfaForm.formState.errors.code?.message}><Input autoComplete="one-time-code" inputMode="text" placeholder="123456 ose ABCD-EFGH-IJKL-MNPQ" {...mfaForm.register("code")} /></Field><AuthError message={error} /><Button type="submit" size="lg" className="w-full" disabled={mfaForm.formState.isSubmitting}>{mfaForm.formState.isSubmitting ? "Duke verifikuar…" : "Verifiko dhe vazhdo"}</Button><Button type="button" variant="ghost" onClick={() => { setMfaChallenge(null); setError(null); }}>Fillo përsëri</Button></form>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell>
        <Card className="w-full max-w-md border-white/10 shadow-lift">
          <CardHeader><img src="/brand/mr-clean-logo.png" alt="Mr. Clean" className="mb-5 h-12 w-auto self-start object-contain" /><CardTitle className="text-2xl">Kyçu në administratë</CardTitle><CardDescription>Panel i mbrojtur për porositë, shitjet, katalogun dhe sigurinë.</CardDescription></CardHeader>
          <CardContent><form className="grid gap-4" onSubmit={loginForm.handleSubmit(login)}><Field label="Email" error={loginForm.formState.errors.email?.message}><Input type="email" autoComplete="email" {...loginForm.register("email")} /></Field><Field label="Fjalëkalimi" error={loginForm.formState.errors.password?.message}><Input type="password" autoComplete="current-password" {...loginForm.register("password")} /></Field><AuthError message={error} /><Button type="submit" size="lg" className="mt-2 w-full" disabled={loginForm.formState.isSubmitting}>{loginForm.formState.isSubmitting ? "Duke u kyçur…" : "Kyçu"}</Button></form></CardContent>
        </Card>
      </AuthShell>
    );
  }

  return <AdminWorkspace user={user} recoveryCodeUsed={recoveryCodeUsed} onLogout={logout} onSessionCleared={resetAuthenticatedState} onRecoveryCodes={(codes) => { setRecoveryCodes(codes); setRecoveryCodesAcknowledged(false); setRecoveryCodeUsed(false); }} />;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return <section className="brand-ink flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-12">{children}</section>;
}

function AuthError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm font-medium text-destructive">{message}</p> : null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
