import { Sparkles, Copy, CheckCircle2, Shield, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";

const JoinUs = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"register" | "status">("register");
  const [affiliation, setAffiliation] = useState<string>("student");
  const [phone, setPhone] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<{ status: string; reviewed_at?: string; decision_reason?: string } | null>(null);

  // Controlled inputs
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [areaOfInterest, setAreaOfInterest] = useState("");
  const [motivation, setMotivation] = useState("");

  // Student
  const [universityName, setUniversityName] = useState("");
  const [department, setDepartment] = useState("");
  const [rollNumber, setRollNumber] = useState("");

  // Professional/Other
  const [organization, setOrganization] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  // Status check
  const [checkToken, setCheckToken] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkResult, setCheckResult] = useState<{ status: string; reviewed_at?: string; decision_reason?: string } | null>(null);

  // Honeypot
  const [honeypot, setHoneypot] = useState("");

  // Success dialog
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Typewriter effect for the right panel
  const phrases = [
    "Learn. Build. Defend.",
    "Collaborate across AI × Cyber.",
    "Ship projects that matter.",
    "Join the ShadowMesh network.",
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIndex % phrases.length];
    const baseSpeed = 40;
    const typingSpeed = isDeleting ? baseSpeed / 1.8 : baseSpeed;

    const tick = () => {
      if (!isDeleting) {
        const next = current.substring(0, displayText.length + 1);
        setDisplayText(next);
        if (next === current) {
          setTimeout(() => setIsDeleting(true), 1200);
        }
      } else {
        const next = current.substring(0, displayText.length - 1);
        setDisplayText(next);
        if (next === "") {
          setIsDeleting(false);
          setPhraseIndex((i) => (i + 1) % phrases.length);
        }
      }
    };

    const t = setTimeout(tick, typingSpeed);
    return () => clearTimeout(t);
  }, [displayText, isDeleting, phraseIndex, phrases]);

  useEffect(() => {
    const saved = localStorage.getItem('shadowmesh_join_submission');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s && s.id) {
          setApplicationId(s.id as string);
          const storedCode = (s.code || s.token) ? String(s.code || s.token).toUpperCase() : null;
          if (storedCode) {
            setSecretCode(storedCode);
            setCheckToken(storedCode);
          }
          setSuccess(true);
        }
      } catch {}
    }
  }, []);

  function basicEmailValid(v: string) {
    return /.+@.+\..+/.test(v);
  }

  async function validatePhone(input: string) {
    setPhone(input);
    setPhoneError("");
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      setPhoneError("Enter a valid phone (e.g., +923001234567)");
    }
  }

  async function checkStatus() {
    if (!checkToken.trim()) {
      toast({ title: "Enter your ShadowMesh code", description: "Use the code shown after submission or in your email." });
      return;
    }
    setCheckingStatus(true);
    setCheckResult(null);
    try {
      const payloadKey = checkToken.includes("-") ? "verification_token" : "code";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ [payloadKey]: checkToken.trim() }),
      });
      if (res.ok) {
        const info = await res.json();
        setCheckResult(info);
      } else {
        const text = await res.text();
        if (text === "not_found") {
          setCheckResult({ status: "not_found" });
        } else {
          throw new Error(text);
        }
      }
    } catch (e: any) {
      toast({ title: "Check failed", description: e.message || "Please try again." });
    } finally {
      setCheckingStatus(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    // Frontend validation
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name." });
      return;
    }
    if (!basicEmailValid(email)) {
      toast({ title: "Valid email required", description: "Please enter a valid email address." });
      return;
    }
    if (affiliation === 'student') {
      if (!universityName.trim() || !department.trim() || !rollNumber.trim()) {
        toast({ title: "Student details required", description: "University, Department and Roll Number are required for students." });
        return;
      }
    } else if (affiliation === 'professional') {
      if (!organization.trim() || !roleTitle.trim()) {
        toast({ title: "Professional details required", description: "Organization and Role are required for professionals." });
        return;
      }
    }
    if (phone && phoneError) {
      toast({ title: "Fix phone number", description: phoneError });
      return;
    }

    const phone_e164 = phone && /^\+[1-9][0-9]{6,14}$/.test(phone) ? phone : null;

    setLoading(true);
    try {
      const { error, data } = await supabase.from('join_applications')
        .insert([{
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          affiliation,
          area_of_interest: areaOfInterest || null,
          motivation: motivation || null,
          university_name: affiliation === 'student' ? universityName : null,
          department: affiliation === 'student' ? department : null,
          roll_number: affiliation === 'student' ? rollNumber : null,
          organization: affiliation !== 'student' ? organization || null : null,
          role_title: affiliation !== 'student' ? roleTitle || null : null,
          raw_phone: phone || null,
          phone_e164,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          ip_addr: null,
          honeypot,
        }])
        .select('id, verification_token')
        .single();

      if (error) throw error;

      setApplicationId(data?.id || null);
      const rawCode = data?.verification_token || null;
      const normalizedCode = rawCode ? String(rawCode).toUpperCase() : null;
      setSecretCode(normalizedCode);
      setCheckToken(normalizedCode || "");
      localStorage.setItem('shadowmesh_join_submission', JSON.stringify({ id: data?.id, code: normalizedCode, token: data?.verification_token, ts: Date.now() }));

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            type: 'join',
            data: { fullName, email, affiliation, phone: phone_e164 || phone || null, universityName, department, rollNumber, organization, roleTitle, areaOfInterest }
          }),
        });
      } catch (e) {
        console.warn('email notify failed', e);
      }

      setSuccess(true);
      setShowSuccessDialog(true);
      // Clear form
      setFullName(""); setEmail(""); setAreaOfInterest(""); setMotivation("");
      setUniversityName(""); setDepartment(""); setRollNumber("");
      setOrganization(""); setRoleTitle(""); setPhone(""); setPhoneError("");
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="join" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -left-10 w-[28rem] h-[28rem] bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-secondary/10 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Be Part of the Revolution</span>
            </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="text-gradient">Join</span> ShadowMesh
            </h2>
          <p className="text-muted-foreground text-lg">Students and professionals welcome — build with AI × Cyber.</p>
          </div>

        {/* Content Layout */}
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Form (Left) */}
          <div className="glass-panel p-8 rounded-2xl glow-border left-glow-edge">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "register" | "status")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="register">Register</TabsTrigger>
                <TabsTrigger value="status">Check Status</TabsTrigger>
              </TabsList>

              <TabsContent value="register">
            {success ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <h3 className="text-2xl font-bold mb-2">Application submitted</h3>
                {applicationId && <p className="text-xs text-muted-foreground mb-2">Application ID: <span className="text-foreground">{applicationId}</span></p>}
                <p className="text-muted-foreground mb-4">Verification in process — you’ll be notified soon.</p>
                {secretCode && (
                  <Card className="max-w-sm mx-auto mb-6 bg-primary/5 border-primary/20">
                    <CardContent className="py-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Your ShadowMesh Code</p>
                      <p className="text-2xl font-mono mt-2 text-foreground">{secretCode}</p>
                      <p className="text-xs text-muted-foreground mt-2">Keep this code safe – use it for status checks, event access, and verification.</p>
                    </CardContent>
                  </Card>
                )}
                <div className="flex gap-3 justify-center">
                  <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem('shadowmesh_join_submission'); setSuccess(false); setApplicationId(null); setSecretCode(null); setStatusInfo(null); }}>New Application</Button>
                  {secretCode && (
                    <Button size="sm" variant="glow" onClick={async () => {
                      try {
                        const res = await fetch(`${SUPABASE_URL}/functions/v1/verify`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ code: secretCode })
                        });
                        if (res.ok) {
                          const info = await res.json();
                          if (info.secret_code) {
                            info.secret_code = String(info.secret_code).toUpperCase();
                            setSecretCode(info.secret_code);
                          }
                          setStatusInfo(info);
                        } else {
                          setStatusInfo({ status: 'pending' });
                        }
                      } catch {
                        setStatusInfo({ status: 'pending' });
                      }
                    }}>Check Status</Button>
                  )}
                </div>
                {statusInfo && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>Status: <span className="text-foreground font-medium">{statusInfo.status}</span></p>
                    {statusInfo.decision_reason && <p>Notes: {statusInfo.decision_reason}</p>}
                  </div>
                )}
              </div>
            ) : (
              <form className="space-y-6" onSubmit={onSubmit}>
                <input type="text" value={honeypot} onChange={(e)=>setHoneypot(e.target.value)} className="hidden" aria-hidden="true" tabIndex={-1} />

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                    <Input value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="John Doe" className="bg-background/50 border-border focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                    <Input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" placeholder="john@example.com" className="bg-background/50 border-border focus:border-primary transition-colors" />
                </div>
              </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input value={phone} onChange={(e) => validatePhone(e.target.value)} placeholder="+923001234567" className={`bg-background/50 border-border focus:border-primary transition-colors ${phoneError ? 'border-destructive' : ''}`} />
                    {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                  </div>
              <div>
                    <label className="block text-sm font-medium mb-2">Affiliation</label>
                    <Select value={affiliation} onValueChange={setAffiliation}>
                      <SelectTrigger className="bg-background/50 border-border">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
              </div>

                <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Area of Interest</label>
                    <Select value={areaOfInterest} onValueChange={setAreaOfInterest}>
                      <SelectTrigger className="bg-background/50 border-border">
                        <SelectValue placeholder="Select your interest area" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AI">AI / Machine Learning</SelectItem>
                        <SelectItem value="Cyber">Cybersecurity</SelectItem>
                        <SelectItem value="Both">Both (AI × Cyber)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
              </div>

                {affiliation === 'student' ? (
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">University Name</label>
                      <Input value={universityName} onChange={(e)=>setUniversityName(e.target.value)} placeholder="Riphah International University Faisalabad" className="bg-background/50 border-border focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Department</label>
                      <Input value={department} onChange={(e)=>setDepartment(e.target.value)} placeholder="CS / SE / AI / CE" className="bg-background/50 border-border focus:border-primary transition-colors" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium mb-2">Roll Number</label>
                      <Input value={rollNumber} onChange={(e)=>setRollNumber(e.target.value)} placeholder="RIUF-CS-2024-001" className="bg-background/50 border-border focus:border-primary transition-colors" />
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Organization / University</label>
                      <Input value={organization} onChange={(e)=>setOrganization(e.target.value)} placeholder="Company or Institute Name" className="bg-background/50 border-border focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Role / Title</label>
                      <Input value={roleTitle} onChange={(e)=>setRoleTitle(e.target.value)} placeholder="Security Engineer, Researcher, etc." className="bg-background/50 border-border focus:border-primary transition-colors" />
                    </div>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium mb-2">Why do you want to join?</label>
                  <Textarea value={motivation} onChange={(e)=>setMotivation(e.target.value)} placeholder="Tell us about your passion for cyber and AI..." rows={4} className="bg-background/50 border-border focus:border-primary transition-colors resize-none" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                  <Button type="submit" size="lg" variant="cyber" className="flex-1" disabled={loading}>{loading ? 'Submitting...' : 'Submit Application'}</Button>
                <Button type="button" size="lg" variant="outline" className="flex-1" asChild>
                    <a href="#events">View Upcoming Events</a>
                </Button>
              </div>
                <p className="text-xs text-muted-foreground mt-3">Your data will be securely stored and used only for ShadowMesh community and event purposes.</p>
            </form>
            )}
              </TabsContent>

              <TabsContent value="status">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">ShadowMesh Code</label>
                    <Input
                      value={checkToken}
                      onChange={(e) => setCheckToken(e.target.value.toUpperCase())}
                      placeholder="e.g., SMAB12CD"
                      className="bg-background/50 border-border focus:border-primary transition-colors"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Use the code shown after registration (also emailed). This code unlocks status checks and event access.</p>
                  </div>
                  <Button type="button" size="lg" variant="cyber" className="w-full" onClick={checkStatus} disabled={checkingStatus}>
                    {checkingStatus ? "Checking..." : "Check Status"}
                  </Button>
                  {checkResult && (
                    <Card className="p-6 mt-4">
                      {checkResult.status === "not_found" ? (
                        <div className="text-center">
                          <p className="text-destructive font-medium">Application not found</p>
                          <p className="text-sm text-muted-foreground mt-2">Double-check your verification token or register first.</p>
                        </div>
                      ) : checkResult.status === "approved" ? (
                        <div className="text-center space-y-3">
                          <Badge variant="secondary" className="text-base px-4 py-2">✓ Approved</Badge>
                          <p className="text-foreground font-medium">Congratulations! You're now a member of ShadowMesh.</p>
                          <p className="text-sm text-muted-foreground">Check your email for the welcome message and password setup link.</p>
                          <Button
                            variant="glow"
                            className="mt-4"
                            onClick={() => {
                              window.location.href = "/member-portal";
                            }}
                          >
                            Go to Member Portal
                          </Button>
                        </div>
                      ) : checkResult.status === "rejected" ? (
                        <div className="text-center space-y-3">
                          <Badge variant="destructive" className="text-base px-4 py-2">Rejected</Badge>
                          <p className="text-foreground">Your application was not approved at this time.</p>
                          {checkResult.decision_reason && (
                            <Card className="p-4 bg-destructive/10 border-destructive/20 mt-3">
                              <p className="text-sm font-medium mb-1">Reason:</p>
                              <p className="text-sm text-muted-foreground">{checkResult.decision_reason}</p>
                            </Card>
                          )}
                          <p className="text-sm text-muted-foreground mt-3">You're welcome to re-apply in the future.</p>
                        </div>
                      ) : (
                        <div className="text-center space-y-3">
                          <Badge variant="outline" className="text-base px-4 py-2">Pending</Badge>
                          <p className="text-foreground">Your application is under review.</p>
                          <p className="text-sm text-muted-foreground">We'll notify you via email once a decision is made.</p>
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Animated Right (Typewriter Panel) */}
          <div className="relative min-h-[420px] flex items-center justify-center">
            <div className="absolute inset-0 -z-10 bg-gradient-premium opacity-70"></div>
            <div className="w-full max-w-md glass-panel-premium rounded-2xl p-8 text-center shadow-xl">
              <p className="text-sm uppercase tracking-widest text-muted-foreground mb-3">ShadowMesh Manifesto</p>
              <h3 className="text-3xl font-bold mb-2 hero-lux-gradient animate-gradient-glow">Join the Network</h3>
              <p className="text-muted-foreground mb-6">Mesh minds across Cybersecurity and AI. Learn with peers, build prototypes, and defend the future.</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-2xl font-extrabold text-foreground/90">
                  {displayText}<span className="type-caret">|</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Typing: Learn • Build • Defend • Collaborate • Innovate</p>
            </div>
          </div>
          </div>

          {/* Info Text */}
        <p className="text-center text-sm text-muted-foreground mt-6">By joining, you'll get access to exclusive workshops, mentorship, and networking opportunities.</p>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl text-center">Application Submitted Successfully!</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Your application is under review. We'll notify you via email once a decision is made.
            </DialogDescription>
          </DialogHeader>
          
          {secretCode && (
            <div className="space-y-4 py-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your ShadowMesh Code</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-background/50 rounded-lg p-3 border border-primary/20">
                    <p className="text-3xl font-mono font-bold text-foreground tracking-wider">{secretCode}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(secretCode);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }}
                      className="shrink-0"
                    >
                      {codeCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3 rounded-lg bg-muted/50 p-4 border border-border">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold mb-1">Why This Code Matters</p>
                    <p className="text-xs text-muted-foreground">
                      This unique code is your key to accessing ShadowMesh services. Keep it safe and secure.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground pl-8">
                  <p>• Use it to check your application status</p>
                  <p>• Required for event registration and attendance</p>
                  <p>• Access your member portal after approval</p>
                  <p>• Verify your identity for workshops and hackathons</p>
                </div>
              </div>

              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs font-medium text-destructive mb-1">⚠️ Important Security Notice</p>
                <p className="text-xs text-muted-foreground">
                  Never share this code publicly. Store it securely - you won't be able to recover it if lost. 
                  We recommend saving it in a password manager or writing it down in a safe place.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessDialog(false);
                setActiveTab("status");
              }}
            >
              Check Status
            </Button>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                setActiveTab("status");
              }}
              className="flex-1"
            >
              Got it, thanks!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default JoinUs;
