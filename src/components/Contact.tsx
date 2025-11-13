import { Mail, Instagram, Linkedin, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";

const Contact = () => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMessageType, setEmailMessageType] = useState<"error" | "warning" | "success" | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneMessageType, setPhoneMessageType] = useState<"error" | "warning" | "success" | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const emailValidationRequest = useRef(0);
  const phoneValidationRequest = useRef(0);
  const emailDebounceRef = useRef<number | undefined>(undefined);
  const phoneDebounceRef = useRef<number | undefined>(undefined);

  const socialLinks = [
    { type: "ig", label: "Instagram", href: "https://instagram.com/shadowmesh.riuf", color: "hover:text-[#E4405F]" },
    { type: "in", label: "LinkedIn", href: "https://linkedin.com/company/shadowmesh", color: "hover:text-[#0A66C2]" },
    { type: "gh", label: "GitHub", href: "https://github.com/shadowmesh", color: "hover:text-foreground" },
    { type: "yt", label: "YouTube", href: "https://youtube.com/@shadowmesh", color: "hover:text-[#FF0000]" },
  ];

  function validEmail(v: string) { return /.+@.+\..+/.test(v); }

  const reasonMeta: Record<string, { message: string; type: "error" | "warning" | "success" }> = {
    disposable: { message: "Temporary / disposable email addresses are not allowed.", type: "error" },
    no_mx: { message: "Email domain has no valid mail server (MX records).", type: "error" },
    smtp: { message: "We couldn't verify this mailbox. We'll trust it, but please confirm it's correct.", type: "warning" },
    syntax: { message: "Enter a valid email address.", type: "error" },
  };

  const phoneReasonMeta: Record<string, { message: string; type: "error" | "warning" }> = {
    format: { message: "Enter phone in international format (e.g., +923001234567).", type: "error" },
    api_invalid: { message: "We couldn't verify this phone number. Please double-check or try a different one.", type: "warning" },
    api_unverified: { message: "We couldn't verify this phone number right now. We'll trust it, but please confirm it's correct.", type: "warning" },
  };

  const COUNTRY_LABELS: Record<string, string> = {
    PK: "Pakistan",
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
    AE: "United Arab Emirates",
    SA: "Saudi Arabia",
    QA: "Qatar",
    BH: "Bahrain",
    KW: "Kuwait",
    TR: "Turkey",
    DE: "Germany",
    FR: "France",
    ES: "Spain",
    IT: "Italy",
    AU: "Australia",
    NZ: "New Zealand",
    SG: "Singapore",
    MY: "Malaysia",
    CN: "China",
    JP: "Japan",
    TH: "Thailand",
    PH: "Philippines",
    ID: "Indonesia",
    BD: "Bangladesh",
    LK: "Sri Lanka",
    NP: "Nepal",
    AF: "Afghanistan",
    IR: "Iran",
    IQ: "Iraq",
    JO: "Jordan",
    LB: "Lebanon",
    EG: "Egypt",
    ZA: "South Africa",
    CA: "Canada",
  };

  function formatCountryLabel(code?: string | null) {
    if (!code) return "";
    const upper = code.toUpperCase();
    return COUNTRY_LABELS[upper] ?? upper;
  }

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
    if (!validEmail(normalized)) {
      if (!skipFormatCheck) {
        const meta = reasonMeta.syntax;
        setEmailMessage(meta.message);
        setEmailMessageType(meta.type);
        if (!silent) {
          toast({ title: "Email invalid", description: meta.message, variant: "destructive" });
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
      console.error("Email validation error (contact)", err);
      if (!silent) {
        toast({
          title: "Email check unavailable",
          description: "We couldn't verify the email right now. Please try again later.",
        });
      }
      if (requestId === emailValidationRequest.current) {
        setEmailMessage("We couldn't verify the email right now. We'll trust it, but please confirm it's correct.");
        setEmailMessageType("warning");
      }
      setCheckingEmail(false);
      return validEmail(normalized);
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
        if (requestId === phoneValidationRequest.current) {
          const meta = phoneReasonMeta[payload.reason as keyof typeof phoneReasonMeta] ?? phoneReasonMeta.format;
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
      console.error("Phone validation error (contact)", err);
      if (!silent) {
        toast({
          title: "Phone check unavailable",
          description: "We couldn't verify the phone number right now.",
        });
      }
      if (requestId === phoneValidationRequest.current) {
        setPhoneMessage("We couldn't verify the phone number right now. We'll trust it, but please confirm it's correct.");
        setPhoneMessageType("warning");
      }
      setCheckingPhone(false);
      return true;
    } finally {
      if (requestId === phoneValidationRequest.current) {
        setCheckingPhone(false);
      }
    }
  }

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
    if (!validEmail(normalized)) {
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

  function handlePhoneInput(v: string) {
    setPhone(v);
    const trimmed = v.trim();
    if (!trimmed) {
      setPhoneMessage("");
      setPhoneMessageType(null);
      return;
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      setPhoneMessage("Enter phone in international format (e.g., +923001234567).");
      setPhoneMessageType("error");
    } else {
      setPhoneMessage("");
      setPhoneMessageType(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!name.trim()) { toast({ title: 'Name required' }); return; }
    const emailOk = await validateEmailRemote(email, { silent: false });
    if (!emailOk) return;
    if (!msg.trim()) { toast({ title: 'Message required' }); return; }

    const phoneOk = await validatePhoneRemote(phone || "", { silent: false });
    if (!phoneOk) return;

    const phone_e164 = phone && /^\+[1-9][0-9]{6,14}$/.test(phone) ? phone : null;

    setLoading(true);
    try {
      const { error } = await supabase.from('contact_messages').insert([{
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: msg.trim(),
        raw_phone: phone || null,
        phone_e164,
        source_page: typeof location !== 'undefined' ? location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ip_addr: null,
        honeypot,
      }]);
      if (error) throw error;
      setSuccess(true);
      toast({ title: 'Message sent', description: 'We will get back to you shortly.' });
      setName(''); setEmail(''); setPhone(''); setMsg('');
      setEmailMessage(""); setEmailMessageType(null);
      setPhoneMessage(""); setPhoneMessageType(null);

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            type: 'contact',
            data: { name, email, phone, message: msg }
          }),
        });
      } catch (e) {
        console.warn('email notify failed', e);
      }
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="contact" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background pointer-events-none" />
      <div className="container mx-auto px-4 relative">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">Get in Touch</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Have questions? Want to collaborate? We'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="glass-panel p-8 rounded-2xl left-glow-edge">
              {success ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Message sent</h3>
                  <p className="text-muted-foreground">Thanks for reaching out — we’ll reply soon.</p>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={onSubmit}>
                  <input type="text" value={honeypot} onChange={(e)=>setHoneypot(e.target.value)} className="hidden" aria-hidden="true" tabIndex={-1} />

                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                    <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" className="bg-background/50 border-border focus:border-primary transition-colors" />
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
                          if (normalized && validEmail(normalized)) {
                            setCheckingEmail(true);
                          }
                        }}
                        onBlur={() => void validateEmailRemote(email, { silent: true })}
                        type="email"
                        placeholder="your.email@example.com"
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

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone (optional)</label>
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
                  <label className="block text-sm font-medium mb-2">Message</label>
                    <Textarea value={msg} onChange={(e)=>setMsg(e.target.value)} placeholder="Tell us what's on your mind..." rows={5} className="bg-background/50 border-border focus:border-primary transition-colors resize-none" />
                </div>

                  <Button type="submit" size="lg" variant="cyber" className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send Message'}</Button>
              </form>
              )}
            </div>

            {/* Contact Info & Socials */}
            <div className="space-y-8">
              {/* Email */}
              <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/20">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email Us</h3>
                    <a 
                      href="mailto:shadowmesh.community@gmail.com" 
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      shadowmesh.community@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="font-semibold mb-4">Connect With Us</h3>
                <div className="grid grid-cols-2 gap-4">
                  {socialLinks.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-card/50 transition-all duration-300 group ${social.color}`}
                      >
                      {social.type === "yt" ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                          <path d="M23 7.5s-.2-1.6-.8-2.3c-.7-.8-1.5-.8-1.9-.9C17.6 3.9 12 3.9 12 3.9s-5.6 0-8.3.4c-.4.1-1.2.1-1.9.9C.2 5.9 0 7.5 0 7.5S0 9.4 0 11.3v1.4c0 1.9.2 3.8.2 3.8s.2 1.6.8 2.3c.7.8 1.7.8 2.1.9 1.5.1 7 .4 8.9.4 0 0 5.6 0 8.3-.4.4-.1 1.2-.1 1.9-.9.6-.7.8-2.3.8-2.3s.2-1.9.2-3.8v-1.4c0-1.9-.2-3.8-.2-3.8Z"/>
                          <path d="M9.75 9.5v5l5-2.5-5-2.5Z" fill="#fff"/>
                        </svg>
                      ) : social.type === "ig" ? (
                        <Instagram className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                      ) : social.type === "in" ? (
                        <Linkedin className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                      ) : (
                        <Github className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                      )}
                        <span className="text-sm font-medium">{social.label}</span>
                      </a>
                  ))}
                </div>
              </div>

              {/* Community Info */}
              <div className="glass-panel p-6 rounded-xl glow-border">
                <h3 className="font-semibold mb-2">Join the Community</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Be part of Pakistan's fastest-growing cyber and AI innovation network.
                </p>
                <Button variant="glow" className="w-full" asChild>
                  <a href="#join">Become a Member</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
