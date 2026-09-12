import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Chrome,
  Shield,
  CheckCircle,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthContext";
import { signInWithEmail, signInWithMagicLink } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { capturePendingReferral, getReferralLinkInfo, prepareReferralClaim, type ReferralLinkInfo } from "@/lib/referral";
import AuthAside from "@/components/auth/AuthAside";

type RegisterStep = "form" | "otp" | "password";

function makeCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, result: a + b };
}

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated } = useAuth();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login (password + OTP email 2FA)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginStep, setLoginStep] = useState<"form" | "otp">("form");
  const [loginOtp, setLoginOtp] = useState("");

  // Captcha (registrazione con email)
  const [captcha, setCaptcha] = useState(() => makeCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  // Register (multi-step)
  const [regStep, setRegStep] = useState<RegisterStep>("form");
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regAcceptTerms, setRegAcceptTerms] = useState(false);
  const [regOtp, setRegOtp] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Magic link
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  // Link di invito: mostra chi ha invitato e prepara il ticket lato server
  const [refCode, setRefCode] = useState<string | null>(null);
  const [refInfo, setRefInfo] = useState<ReferralLinkInfo | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    const code = fromUrl ? capturePendingReferral() : null;
    if (!code) return;
    setRefCode(code);
    setAuthMode("register");
    void prepareReferralClaim();
    void getReferralLinkInfo(code).then((info) => info?.valid && setRefInfo(info));
  }, []);

  useEffect(() => {
    const isOAuthReturn = new URLSearchParams(window.location.search).get("oauth") === "callback";
    if (isOAuthReturn && isAuthenticated) navigate("/Dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const resetRegister = () => {
    setRegStep("form");
    setRegFullName("");
    setRegEmail("");
    setRegAcceptTerms(false);
    setRegOtp("");
    setRegPassword("");
    setCaptcha(makeCaptcha());
    setCaptchaAnswer("");
  };




  // -------------------- Google --------------------
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const result = await login();
    if (!result.success) {
      toast({ title: "Errore", description: result.error || "Errore login Google", variant: "destructive" });
      setIsLoading(false);
    }
  };

  // -------------------- LOGIN with password --------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      if (!result.success) {
        toast({ title: "Errore", description: result.error || "Errore", variant: "destructive" });
        return;
      }
      // Password corretta: chiudiamo la sessione e richiediamo un OTP via email (2FA)
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
        return;
      }
      setLoginOtp("");
      setLoginStep("otp");
      toast({ title: "Codice inviato", description: `Controlla ${email} per il codice a 6 cifre.` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginOtp.length !== 6) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: loginOtp,
        type: "email",
      });
      if (error) {
        toast({ title: "Codice errato", description: "Il codice non è valido o è scaduto", variant: "destructive" });
        return;
      }
      toast({ title: "Login effettuato!", description: "Bentornato su DivideIt!" });
      navigate("/Dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendLoginOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      toast(
        error
          ? { title: "Errore", description: error.message, variant: "destructive" }
          : { title: "Codice rinviato", description: `Nuovo codice inviato a ${email}` },
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------- REGISTER step 1: send signup OTP --------------------
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim()) {
      toast({ title: "Errore", description: "Inserisci nome e email", variant: "destructive" });
      return;
    }
    if (!regAcceptTerms) {
      toast({ title: "Errore", description: "Devi accettare i Termini e Condizioni", variant: "destructive" });
      return;
    }
    if (parseInt(captchaAnswer, 10) !== captcha.result) {
      toast({ title: "Captcha errato", description: "Risolvi correttamente l'operazione", variant: "destructive" });
      setCaptcha(makeCaptcha());
      setCaptchaAnswer("");
      return;
    }
    setIsLoading(true);
    try {
      await prepareReferralClaim();
      // Usa lo stesso canale OTP del login (template "Magic Link" con {{ .Token }}),
      // così il codice a 6 cifre arriva davvero via email.
      const { error } = await supabase.auth.signInWithOtp({
        email: regEmail.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: { full_name: regFullName.trim() },
          emailRedirectTo: "https://c-charm-creator.lovable.app/Dashboard",
        },
      });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes("already") || m.includes("registered")) {
          toast({ title: "Email già registrata", description: "Accedi invece di registrarti", variant: "destructive" });
        } else if (m.includes("rate") || m.includes("too many")) {
          toast({ title: "Troppi tentativi", description: "Riprova tra qualche minuto", variant: "destructive" });
        } else {
          toast({ title: "Errore", description: error.message, variant: "destructive" });
        }
        return;
      }

      toast({ title: "Codice inviato", description: `Controlla ${regEmail} per il codice a 6 cifre.` });
      setRegStep("otp");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------- REGISTER step 2: verify OTP --------------------
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regOtp.length !== 6) {
      toast({ title: "Codice non valido", description: "Il codice deve avere 6 cifre", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: regEmail.trim().toLowerCase(),
        token: regOtp,
        type: "email",
      });
      if (error) {
        toast({ title: "Codice errato", description: "Il codice non è valido o è scaduto", variant: "destructive" });
        return;
      }
      setRegStep("password");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------- REGISTER step 3: set password --------------------
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 8) {
      toast({ title: "Password troppo corta", description: "Almeno 8 caratteri", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: regPassword,
        data: { full_name: regFullName.trim() },
      });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Registrazione completata!", description: `Benvenuto su DivideIt, ${regFullName}!` });
      resetRegister();
      navigate("/Dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------- REGISTER: resend OTP --------------------
  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: regEmail.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: { full_name: regFullName.trim() },
          emailRedirectTo: "https://c-charm-creator.lovable.app/Dashboard",
        },
      });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Codice rinviato", description: `Nuovo codice inviato a ${regEmail}` });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------- Magic Link --------------------
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail) return;
    setIsLoading(true);
    const result = await signInWithMagicLink(magicEmail);
    setIsLoading(false);
    if (result.success) setMagicSent(true);
    else toast({ title: "Errore", description: result.error, variant: "destructive" });
  };

  const passwordValid = regPassword.length >= 8;

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,26rem)_1fr] xl:grid-cols-[minmax(0,30rem)_1fr]">
      <AuthAside />

      <main className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (authMode === "register" && regStep !== "form") {
                setRegStep("form");
              } else if (authMode === "login" && loginStep !== "form") {
                setLoginStep("form");
              } else {
                navigate("/");
              }
            }}
            className="-ml-3 gap-2 rounded-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {(authMode === "register" && regStep !== "form") || (authMode === "login" && loginStep !== "form")
              ? "Indietro"
              : "Torna alla home"}
          </Button>

          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <img
              src="/divideit-logo.png"
              alt="DivideIt"
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-border"
            />
            <span className="font-display text-sm font-extrabold tracking-[-0.02em] text-foreground">
              DIVIDEIT
            </span>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[26rem]"
          >
            <div className="mb-8">
              <span className="eyebrow">
                {authMode === "login" ? "Bentornato" : "Crea account"}
              </span>
              <h1 className="display-lg mt-4 text-foreground text-balance">
                {authMode === "login" ? "Accedi a DivideIt" : "Inizia a dividere"}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {authMode === "login" && loginStep === "otp" && "Inserisci il codice di verifica che ti abbiamo inviato."}
                {authMode === "register" && regStep === "otp" && "Inserisci il codice di verifica che ti abbiamo inviato."}
                {authMode === "register" && regStep === "password" && "Scegli una password per proteggere il tuo account."}
                {((authMode === "login" && loginStep === "form") || (authMode === "register" && regStep === "form")) &&
                  "Scegli il metodo che preferisci per continuare."}
              </p>
            </div>

            {refCode && (
              <div className="panel-quiet mb-6 flex items-center gap-3 p-4 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {refInfo?.referrer_name
                      ? `${refInfo.referrer_name} ti ha invitato`
                      : "Sei stato invitato su DivideIt"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Codice invito <span className="font-semibold text-foreground">{refCode}</span> — valido solo
                    per una nuova email mai registrata.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* ============ REGISTER OTP STEP ============ */}
              {authMode === "register" && regStep === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Abbiamo inviato un codice a 6 cifre a<br />
                      <strong className="text-foreground">{regEmail}</strong>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={regOtp} onChange={setRegOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button type="submit" className="w-full h-12" disabled={isLoading || regOtp.length !== 6}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Avanti"}
                  </Button>

                  <div className="text-center">
                    <Button type="button" variant="link" className="text-sm" onClick={handleResendOtp} disabled={isLoading}>
                      Non hai ricevuto il codice? Reinvia
                    </Button>
                  </div>
                </form>
              )}

              {/* ============ REGISTER PASSWORD STEP ============ */}
              {authMode === "register" && regStep === "password" && (
                <form onSubmit={handleSetPassword} className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <KeyRound className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Inserisci la tua password (almeno 8 caratteri)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="regPwd">Password</Label>
                    <div className="relative">
                      <Input
                        id="regPwd"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    <p className={`text-xs ${passwordValid ? "text-green-600" : "text-muted-foreground"}`}>
                      {passwordValid ? "✓ Lunghezza valida" : `${regPassword.length}/8 caratteri minimi`}
                    </p>
                  </div>

                  <Button type="submit" className="w-full h-12" disabled={isLoading || !passwordValid}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrati"}
                  </Button>
                </form>
              )}

              {/* ============ LOGIN or REGISTER FORM STEP ============ */}
              {/* ============ LOGIN OTP STEP ============ */}
              {authMode === "login" && loginStep === "otp" && (
                <form onSubmit={handleVerifyLoginOtp} className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Per sicurezza abbiamo inviato un codice a 6 cifre a<br />
                      <strong className="text-foreground">{email}</strong>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={loginOtp} onChange={setLoginOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button type="submit" className="w-full h-12" disabled={isLoading || loginOtp.length !== 6}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Accedi"}
                  </Button>

                  <div className="text-center">
                    <Button type="button" variant="link" className="text-sm" onClick={handleResendLoginOtp} disabled={isLoading}>
                      Non hai ricevuto il codice? Reinvia
                    </Button>
                  </div>
                </form>
              )}

              {((authMode === "login" && loginStep === "form") || (authMode === "register" && regStep === "form")) && (
                <>
                  <Button
                    variant="outline"
                    className="w-full h-12 gap-3 text-base font-medium"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Chrome className="h-5 w-5 text-red-500" />}
                    Continua con Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Oppure</span>
                    </div>
                  </div>

                  <Tabs defaultValue="email" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="email" className="gap-2">
                        <Mail className="h-4 w-4" /> Email
                      </TabsTrigger>
                      <TabsTrigger value="magic" className="gap-2">
                        <Sparkles className="h-4 w-4" /> Magic Link
                      </TabsTrigger>
                    </TabsList>

                    {/* EMAIL TAB */}
                    <TabsContent value="email" className="space-y-4 mt-4">
                      {authMode === "login" ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="loginEmail">Email</Label>
                            <Input
                              id="loginEmail"
                              type="email"
                              placeholder="nome@esempio.it"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="loginPwd">Password</Label>
                              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
                                Password dimenticata?
                              </Link>
                            </div>
                            <div className="relative">
                              <Input
                                id="loginPwd"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </div>
                          <Button type="submit" className="w-full h-12" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Accedi"}
                          </Button>
                        </form>
                      ) : (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="regName">Nome e cognome</Label>
                            <Input
                              id="regName"
                              type="text"
                              placeholder="Mario Rossi"
                              value={regFullName}
                              onChange={(e) => setRegFullName(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="regEmail">Email</Label>
                            <Input
                              id="regEmail"
                              type="email"
                              placeholder="nome@esempio.it"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="captcha">
                              Verifica anti-bot: quanto fa {captcha.a} + {captcha.b}?
                            </Label>
                            <Input
                              id="captcha"
                              type="text"
                              inputMode="numeric"
                              placeholder="Risultato"
                              value={captchaAnswer}
                              onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\D/g, ""))}
                              required
                            />
                          </div>

                          <div className="flex items-start gap-2">
                            <Checkbox
                              id="terms"
                              checked={regAcceptTerms}
                              onCheckedChange={(c) => setRegAcceptTerms(c === true)}
                              className="mt-1"
                            />
                            <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
                              Accetto i{" "}
                              <Link to="/TermsOfService" className="font-medium text-primary underline underline-offset-2">
                                Termini e Condizioni
                              </Link>{" "}
                              e la{" "}
                              <Link to="/PrivacyPolicy" className="font-medium text-primary underline underline-offset-2">
                                Privacy Policy
                              </Link>
                            </Label>
                          </div>

                          <Button
                            type="submit"
                            className="w-full h-12"
                            disabled={isLoading || !regAcceptTerms || !regFullName.trim() || !regEmail.trim() || !captchaAnswer}
                          >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrati"}
                          </Button>
                        </form>
                      )}

                      <div className="text-center">
                        <Button
                          variant="link"
                          className="text-sm"
                          onClick={() => {
                            setAuthMode(authMode === "login" ? "register" : "login");
                            setLoginStep("form");
                            setLoginOtp("");
                            resetRegister();
                          }}
                        >
                          {authMode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* MAGIC LINK TAB */}
                    <TabsContent value="magic" className="space-y-4 mt-4">
                      {magicSent ? (
                        <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 space-y-2">
                          <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Link inviato a <strong>{magicEmail}</strong>. Cliccalo per accedere senza password.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleMagicLink} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="magicEmail">Email</Label>
                            <Input
                              id="magicEmail"
                              type="email"
                              placeholder="nome@esempio.it"
                              value={magicEmail}
                              onChange={(e) => setMagicEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full h-12" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Invia magic link"}
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">
                            Ti invieremo un link sicuro: cliccalo dall'email e sarai dentro.
                          </p>
                        </form>
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="hairline flex items-start gap-2.5 pt-5 text-xs leading-relaxed text-muted-foreground">
                    <Shield className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>I tuoi dati sono protetti. La password viene salvata in modo cifrato (Supabase Auth).</p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
