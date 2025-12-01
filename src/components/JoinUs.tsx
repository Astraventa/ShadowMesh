import { Sparkles, CheckCircle2, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const inviteParam = searchParams.get("invite");
  const [activeTab] = useState<"register">("register");
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [affiliation, setAffiliation] = useState<string>("student");
  const [phone, setPhone] = useState<string>("");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneMessageType, setPhoneMessageType] = useState<"error" | "warning" | "success" | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMessageType, setEmailMessageType] = useState<"error" | "warning" | "success" | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isSpecialUser, setIsSpecialUser] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);

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

  // Status check removed - industry level approach

  // Honeypot
  const [honeypot, setHoneypot] = useState("");

  // Success dialog
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

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

  const emailValidationRequest = useRef(0);

  // Check for pending invite on mount
  useEffect(() => {
    const pendingInvite = localStorage.getItem("pending_team_invite");
    setHasPendingInvite(!!pendingInvite || inviteParam === "true");
    
    // Scroll to join section if coming from invite link
    if (inviteParam === "true" || pendingInvite) {
      // Small delay to ensure page is rendered
      setTimeout(() => {
        const joinSection = document.getElementById("join");
        if (joinSection) {
          joinSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [inviteParam]);
  const phoneValidationRequest = useRef(0);
  const emailDebounceRef = useRef<number | undefined>(undefined);
  const phoneDebounceRef = useRef<number | undefined>(undefined);

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

  function handlePhoneInput(input: string) {
    setPhone(input);
    setPhoneMessage("");
    setPhoneMessageType(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      setPhoneMessage("Enter a valid phone (e.g., +923001234567)");
      setPhoneMessageType("error");
    }
  }

  const reasonMeta: Record<string, { message: string; type: "error" | "warning" | "success" }> = {
    disposable: { message: "Temporary / disposable email addresses are not allowed.", type: "error" },
    no_mx: { message: "Email domain has no valid mail server (MX records).", type: "error" },
    smtp: { message: "We couldn't verify this mailbox. We'll trust it, but please confirm it's correct.", type: "warning" },
    syntax: { message: "Enter a valid email address.", type: "error" },
  };

  const phoneReasonMeta: Record<string, { message: string; type: "error" | "warning" }> = {
    format: { message: "Enter a valid phone number (international format, e.g., +923001234567).", type: "error" },
    api_invalid: { message: "We couldn't verify this phone number. Please double-check or try a different one.", type: "warning" },
    api_unverified: { message: "We couldn't verify this phone number right now. We'll trust it, but please confirm it's correct.", type: "warning" },
  };

  async function checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      
      if (error) {
        console.error("Error checking email existence:", error);
        return false; // Don't block on error
      }
      return !!data;
    } catch (err) {
      console.error("Error checking email existence:", err);
      return false;
    }
  }

  async function checkPhoneExists(phone: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id")
        .eq("phone", phone.trim())
        .maybeSingle();
      
      if (error) {
        console.error("Error checking phone existence:", error);
        return false; // Don't block on error
      }
      return !!data;
    } catch (err) {
      console.error("Error checking phone existence:", err);
      return false;
    }
  }

  async function validateEmailRemote(value: string, options: { silent?: boolean; skipFormatCheck?: boolean } = {}) {
    const { silent = false, skipFormatCheck = false } = options;
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      setEmailMessage("");
      setEmailMessageType(null);
      setCheckingEmail(false);
      return false;
    }
    if (!basicEmailValid(normalized)) {
      if (!skipFormatCheck) {
        const meta = reasonMeta.syntax;
        setEmailMessage(meta.message);
        setEmailMessageType(meta.type);
        if (!silent) {
          toast({ title: "Email required", description: meta.message, variant: "destructive" });
        }
      } else {
        setEmailMessage("");
        setEmailMessageType(null);
      }
      setCheckingEmail(false);
      return false;
    }

    const requestId = ++emailValidationRequest.current;
    setCheckingEmail(true);
    setEmailMessage("");
    setEmailMessageType(null);
    try {
      // First check if email already exists
      const exists = await checkEmailExists(normalized);
      if (exists && requestId === emailValidationRequest.current) {
        setEmailMessage("This email is already registered. Please use a different email or log in.");
        setEmailMessageType("error");
        setCheckingEmail(false);
        if (!silent) {
          toast({ title: "Email already taken", description: "This email is already registered.", variant: "destructive" });
        }
        return false;
      }

      // Then validate email format/quality
      const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: normalized }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? `Email validation failed with status ${res.status}`);
      }
      if (payload?.valid === false) {
        const meta = reasonMeta[payload.reason as keyof typeof reasonMeta] ?? {
          message: "Please use a real, non-temporary email.",
          type: "error",
        };
        if (requestId === emailValidationRequest.current) {
          setEmailMessage(meta.message);
          setEmailMessageType(meta.type);
          if (!silent && meta.type === "error") {
            toast({ title: "Use a real email", description: meta.message, variant: "destructive" });
          }
        }
        setCheckingEmail(false);
        return meta.type === "warning";
      }
      if (requestId === emailValidationRequest.current) {
        setEmailMessage("Looks good");
        setEmailMessageType("success");
      }
      setCheckingEmail(false);
      return true;
    } catch (err: any) {
      console.error("Email validation error", err);
      if (!silent) {
        toast({
          title: "Email check unavailable",
          description: "We couldn't verify the email right now. Please try again in a moment.",
        });
      }
      // Fall back to allowing submission but keep warning empty so they can resubmit.
      if (requestId === emailValidationRequest.current) {
        setEmailMessage("We couldn't verify the email right now. We'll trust it, but please confirm it's correct.");
        setEmailMessageType("warning");
      }
      setCheckingEmail(false);
      return basicEmailValid(normalized);
    }
  }

  async function validatePhoneRemote(value: string, options: { silent?: boolean; skipFormatCheck?: boolean } = {}) {
    const { silent = false, skipFormatCheck = false } = options;
    const trimmed = value.trim();
    if (!trimmed) {
      setPhoneMessage("");
      setPhoneMessageType(null);
      setCheckingPhone(false);
      return true;
    }
    if (!skipFormatCheck && !/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      const meta = phoneReasonMeta.format;
      setPhoneMessage(meta.message);
      setPhoneMessageType(meta.type);
      setCheckingPhone(false);
      if (!silent) {
        toast({ title: "Phone invalid", description: meta.message, variant: "destructive" });
      }
      return false;
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      setCheckingPhone(false);
      return false;
    }

    const requestId = ++phoneValidationRequest.current;
    setCheckingPhone(true);
    setPhoneMessage("");
    setPhoneMessageType(null);
    try {
      // First check if phone already exists
      const exists = await checkPhoneExists(trimmed);
      if (exists && requestId === phoneValidationRequest.current) {
        setPhoneMessage("This phone number is already registered. Please use a different number or log in.");
        setPhoneMessageType("error");
        setCheckingPhone(false);
        if (!silent) {
          toast({ title: "Phone number already taken", description: "This phone number is already registered.", variant: "destructive" });
        }
        return false;
      }

      // Then validate phone format/quality
      const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-phone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone: trimmed }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? `Phone validation failed with status ${res.status}`);
      }
      if (payload?.valid === false) {
        const meta = phoneReasonMeta[payload.reason as keyof typeof phoneReasonMeta] ?? phoneReasonMeta.format;
        if (requestId === phoneValidationRequest.current) {
          setPhoneMessage(meta.message);
          setPhoneMessageType(meta.type);
          if (!silent) {
            toast({ title: "Phone invalid", description: meta.message, variant: "destructive" });
          }
        }
        setCheckingPhone(false);
        return false;
      }

      if (requestId === phoneValidationRequest.current) {
        if (payload?.status === "warning") {
          const meta = phoneReasonMeta[payload.reason as keyof typeof phoneReasonMeta] ?? phoneReasonMeta.api_unverified;
          const countryLabel = formatCountryLabel(payload?.country);
          setPhoneMessage(`${meta.message}${countryLabel ? ` (detected ${countryLabel})` : ""}`);
          setPhoneMessageType(meta.type);
        } else {
          const countryLabel = formatCountryLabel(payload?.country);
          setPhoneMessage(`Looks good${countryLabel ? ` (${countryLabel})` : ""}`);
          setPhoneMessageType("success");
        }
      }
      setCheckingPhone(false);
      return true;
    } catch (err: any) {
      console.error("Phone validation error", err);
      if (!silent) {
        toast({
          title: "Phone check unavailable",
          description: "We couldn't verify the phone number right now. We'll trust your entry.",
        });
      }
      if (requestId === phoneValidationRequest.current) {
        setPhoneMessage("We couldn't verify the phone number right now. We'll trust it, but please confirm it's correct.");
        setPhoneMessageType("warning");
      }
      setCheckingPhone(false);
      return true;
    }
  }

  // checkStatus function removed - industry level approach, users notified via email

  useEffect(() => {
    if (emailDebounceRef.current) {
      clearTimeout(emailDebounceRef.current);
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setEmailMessage("");
      setEmailMessageType(null);
      setCheckingEmail(false);
      return;
    }
    if (!basicEmailValid(normalized)) {
      setEmailMessage("");
      setEmailMessageType(null);
      setCheckingEmail(false);
      return;
    }
    // Show loading spinner instantly when user types valid email
    setCheckingEmail(true);
    emailDebounceRef.current = window.setTimeout(() => {
      void validateEmailRemote(normalized, { silent: true, skipFormatCheck: true });
    }, 400);
    return () => {
      if (emailDebounceRef.current) {
        clearTimeout(emailDebounceRef.current);
      }
    };
  }, [email]);

  useEffect(() => {
    if (phoneDebounceRef.current) {
      clearTimeout(phoneDebounceRef.current);
    }
    const trimmed = phone.trim();
    if (!trimmed) {
      setPhoneMessage("");
      setPhoneMessageType(null);
      setCheckingPhone(false);
      return;
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      setCheckingPhone(false);
      return;
    }
    // Show loading spinner instantly when user types valid phone
    setCheckingPhone(true);
    phoneDebounceRef.current = window.setTimeout(() => {
      void validatePhoneRemote(trimmed, { silent: true, skipFormatCheck: true });
    }, 400);
    return () => {
      if (phoneDebounceRef.current) {
        clearTimeout(phoneDebounceRef.current);
      }
    };
  }, [phone]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    // Frontend validation
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name." });
      return;
    }
    const emailOk = await validateEmailRemote(email, { silent: false });
    if (!emailOk) {
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
    const phoneOk = await validatePhoneRemote(phone || "", { silent: false });
    if (!phoneOk) {
      return;
    }

    const phone_e164 = phone && /^\+[1-9][0-9]{6,14}$/.test(phone) ? phone : null;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone_e164 || (phone ? phone.trim() : null);

    setLoading(true);
    try {
      // Duplicate checks (run in parallel for speed)
      const [
        existingApplicationEmail,
        existingMemberEmail,
        existingApplicationPhone,
        existingMemberPhone,
      ] = await Promise.all([
        supabase.from('join_applications').select('id,status,created_at').eq('email', normalizedEmail).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('members').select('id,full_name,created_at').eq('email', normalizedEmail).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        normalizedPhone
          ? supabase.from('join_applications').select('id,status,created_at').eq('phone_e164', normalizedPhone).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        normalizedPhone
          ? supabase.from('members').select('id,full_name,created_at').eq('phone_e164', normalizedPhone).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!existingApplicationEmail.error && existingApplicationEmail.data) {
        toast({
          title: "Application already submitted",
          description: "We already have a pending application with this email. Please wait for the review.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (!existingMemberEmail.error && existingMemberEmail.data) {
        toast({
          title: "Already a member",
          description: "This email is already connected to an approved member account. Try logging in instead.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (normalizedPhone && !existingApplicationPhone.error && existingApplicationPhone.data) {
        toast({
          title: "Phone number already used",
          description: "An application with this phone number already exists. Please wait for the review.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (normalizedPhone && !existingMemberPhone.error && existingMemberPhone.data) {
        toast({
          title: "Phone already registered",
          description: "This phone number is already linked to a member profile. Try logging in instead.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error, data } = await supabase.from('join_applications')
        .insert([{
          full_name: fullName.trim(),
          email: normalizedEmail,
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
      localStorage.setItem('shadowmesh_join_submission', JSON.stringify({ id: data?.id, ts: Date.now() }));

      // Check if email is in special welcome emails list
      let isSpecial = false;
      try {
        const { data: adminSettings } = await supabase
          .from("admin_settings")
          .select("special_welcome_emails")
          .limit(1)
          .maybeSingle();
        
        const specialEmailsList = adminSettings?.special_welcome_emails || [];
        isSpecial = specialEmailsList.includes(normalizedEmail.toLowerCase());
        setIsSpecialUser(isSpecial);
        
        // Auto-approve special users (via edge function that checks special emails list)
        if (isSpecial && data?.id) {
          try {
            const approveRes = await fetch(`${SUPABASE_URL}/functions/v1/auto_approve_special`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                application_id: data.id,
                email: normalizedEmail
              })
            });
            
            if (approveRes.ok) {
              setAutoApproved(true);
              // Welcome email is automatically sent by auto_approve_special function
            } else {
              console.warn('Auto-approval failed, will be manually reviewed');
            }
          } catch (e) {
            console.warn('Auto-approval failed, will be manually reviewed:', e);
          }
        }
      } catch (e) {
        console.warn('Failed to check special emails:', e);
      }

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
      setOrganization(""); setRoleTitle(""); setPhone(""); setPhoneMessage(""); setPhoneMessageType(null);
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
          {hasPendingInvite && (
            <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-sm text-primary font-medium">
                ✨ You have a pending team invitation! After approval, you'll automatically be redirected to accept it.
              </p>
            </div>
          )}
          </div>

        {/* Content Layout */}
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Form (Left) */}
          <div className="glass-panel p-8 rounded-2xl glow-border left-glow-edge">
            <Tabs value={activeTab}>
              <TabsContent value="register">
            {success ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <h3 className="text-2xl font-bold mb-2">Application Submitted Successfully</h3>
                <p className="text-muted-foreground mb-4">
                  Your application is <strong>under verification</strong>. You will be notified via email once a decision is made.
                </p>
                <p className="text-sm text-muted-foreground">
                  If approved, you'll receive a welcome email with instructions to set up your password and access the member portal.
                </p>
                <div className="mt-6">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => { 
                      localStorage.removeItem('shadowmesh_join_submission'); 
                      setSuccess(false); 
                      setApplicationId(null);
                    }}
                  >
                    Submit Another Application
                  </Button>
                </div>
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
                    <div className="relative">
                      <Input
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          // Show loading instantly on change
                          const normalized = e.target.value.trim().toLowerCase();
                          if (normalized && basicEmailValid(normalized)) {
                            setCheckingEmail(true);
                          }
                        }}
                        onBlur={() => void validateEmailRemote(email, { silent: true })}
                        type="email"
                        placeholder="john@example.com"
                        className={`pr-9 bg-background/50 border-border focus:border-primary transition-colors ${
                          emailMessageType === "error"
                            ? "border-destructive"
                            : emailMessageType === "warning"
                              ? "border-border"
                              : emailMessageType === "success"
                                ? "border-emerald-500/70"
                                : ""
                        }`}
                      />
                      {checkingEmail && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <span className="block h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40 border-t-primary animate-spin" />
                        </span>
                      )}
                    </div>
                    {emailMessage && !checkingEmail && (
                      <p
                        className={`text-xs mt-1 ${
                          emailMessageType === "warning"
                            ? "text-muted-foreground"
                            : emailMessageType === "success"
                              ? "text-emerald-500"
                              : "text-destructive"
                        }`}
                      >
                        {emailMessage}
                      </p>
                    )}
                </div>
              </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <div className="relative">
                      <Input
                        value={phone}
                        onChange={(e) => {
                          handlePhoneInput(e.target.value);
                          // Show loading instantly on change
                          const trimmed = e.target.value.trim();
                          if (trimmed && /^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
                            setCheckingPhone(true);
                          }
                        }}
                        onBlur={() => void validatePhoneRemote(phone, { silent: true })}
                        placeholder="+923001234567"
                        className={`pr-9 bg-background/50 border-border focus:border-primary transition-colors ${
                          phoneMessageType === "error"
                            ? "border-destructive"
                            : phoneMessageType === "warning"
                              ? "border-border"
                              : phoneMessageType === "success"
                                ? "border-emerald-500/70"
                                : ""
                        }`}
                      />
                      {checkingPhone && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <span className="block h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40 border-t-primary animate-spin" />
                        </span>
                      )}
                    </div>
                    {phoneMessage && !checkingPhone && (
                      <p
                        className={`text-xs mt-1 ${
                          phoneMessageType === "warning"
                            ? "text-muted-foreground"
                            : phoneMessageType === "success"
                              ? "text-emerald-500"
                              : "text-destructive"
                        }`}
                      >
                        {phoneMessage}
                      </p>
                    )}
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
                      <Input value={universityName} onChange={(e)=>setUniversityName(e.target.value)} placeholder="Enter your university name" className="bg-background/50 border-border focus:border-primary transition-colors" />
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

      {/* Success Dialog - Industry Level Approach */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${
              autoApproved ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20" : "bg-primary/20"
            }`}>
              {autoApproved ? (
                <Sparkles className="w-8 h-8 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-primary" />
              )}
            </div>
            <DialogTitle className="text-2xl text-center">
              {autoApproved ? "You Are Special! ✨" : "Application Submitted Successfully!"}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {autoApproved ? (
                <>
                  <p className="text-base font-semibold text-foreground mb-2">
                    Your request has been <strong className="text-amber-500">automatically approved</strong>!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    That's why you received this special treatment. Check your inbox for the welcome email to set up your password and access the member portal.
                  </p>
                </>
              ) : (
                <>
                  Your application is <strong>under verification</strong>. You will be notified via email once a decision is made.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {autoApproved ? (
              <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-yellow-500/5 p-4 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold mb-1 text-amber-700 dark:text-amber-400">What Happens Next?</p>
                    <div className="space-y-2 text-xs text-muted-foreground mt-2">
                      <p>• Check your inbox for the welcome email (sent instantly)</p>
                      <p>• Click the password setup link in the email</p>
                      <p>• Set up your password and log in to the member portal</p>
                      <p>• You'll automatically receive a Star Badge ⭐ as a special member</p>
                      <p>• Start exploring events, hackathons, and networking opportunities</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-4 border border-border">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold mb-1">What Happens Next?</p>
                    <div className="space-y-2 text-xs text-muted-foreground mt-2">
                      <p>• Your application will be reviewed by our team</p>
                      <p>• You'll receive an email notification with the decision</p>
                      <p>• If approved, you'll get a welcome email with password setup instructions</p>
                      <p>• You can then access the member portal and register for events</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                setIsSpecialUser(false);
                setAutoApproved(false);
              }}
              className="w-full"
            >
              {autoApproved ? "Got it, thanks! ✨" : "Got it, thanks!"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default JoinUs;
