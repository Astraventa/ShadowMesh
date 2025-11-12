import { Mail, Instagram, Linkedin, Github, Loader2 } from "lucide-react";
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
  const [emailWarning, setEmailWarning] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [phoneError, setPhoneError] = useState("");
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

  const reasonMessages: Record<string, string> = {
    disposable: "Temporary / disposable email addresses are not allowed.",
    no_mx: "Email domain has no valid mail server (MX records).",
    smtp: "We could not reach this mailbox. Please double-check the email.",
    syntax: "Enter a valid email address.",
  };

  async function validateEmailRemote(value: string, options: { silent?: boolean; skipFormatCheck?: boolean } = {}) {
    const { silent = false, skipFormatCheck = false } = options;
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      setEmailWarning("");
      return false;
    }
    if (!validEmail(normalized)) {
      if (!skipFormatCheck) {
        const message = reasonMessages.syntax;
        setEmailWarning(message);
        if (!silent) {
          toast({ title: "Email invalid", description: message, variant: "destructive" });
        }
      } else {
        setEmailWarning("");
      }
      return false;
    }

    const requestId = ++emailValidationRequest.current;
    setCheckingEmail(true);
    setEmailWarning("");
    try {
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
        if (requestId === emailValidationRequest.current) {
          const message = reasonMessages[payload.reason as keyof typeof reasonMessages] ?? "Please use a real, non-temporary email.";
          setEmailWarning(message);
          if (!silent) {
            toast({ title: "Use a real email", description: message, variant: "destructive" });
          }
        }
        return false;
      }
      if (requestId === emailValidationRequest.current) {
        setEmailWarning("");
      }
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
        setEmailWarning("");
      }
      return validEmail(normalized);
    } finally {
      if (requestId === emailValidationRequest.current) {
        setCheckingEmail(false);
      }
    }
  }

  async function validatePhoneRemote(value: string, options: { silent?: boolean; skipFormatCheck?: boolean } = {}) {
    const { silent = false, skipFormatCheck = false } = options;
    const trimmed = value.trim();
    if (!trimmed) {
      setPhoneError("");
      return true;
    }
    if (!skipFormatCheck && !/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      const message = "Enter phone in international format (e.g., +923001234567).";
      setPhoneError(message);
      if (!silent) {
        toast({ title: "Phone invalid", description: message, variant: "destructive" });
      }
      return false;
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      return false;
    }

    const requestId = ++phoneValidationRequest.current;
    setCheckingPhone(true);
    try {
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
          const message =
            payload.reason === "api"
              ? "We couldn't verify this phone number. Try a different one."
              : "Enter a valid phone number.";
          setPhoneError(message);
          if (!silent) {
            toast({ title: "Phone invalid", description: message, variant: "destructive" });
          }
        }
        return false;
      }
      if (requestId === phoneValidationRequest.current) {
        setPhoneError("");
      }
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
        setPhoneError("");
      }
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
      setEmailWarning("");
      return;
    }
    if (!validEmail(normalized)) {
      setEmailWarning("");
      return;
    }
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
      setPhoneError("");
      return;
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      return;
    }
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
      setPhoneError("");
      return;
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
      setPhoneError("Enter phone in international format (e.g., +923001234567).");
    } else {
      setPhoneError("");
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
                        onChange={(e)=>setEmail(e.target.value)}
                        onBlur={() => void validateEmailRemote(email, { silent: true })}
                        type="email"
                        placeholder="your.email@example.com"
                        className={`pr-9 bg-background/50 border-border focus:border-primary transition-colors ${emailWarning ? "border-destructive" : ""}`}
                      />
                      {checkingEmail && (
                        <Loader2 className="w-4 h-4 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      )}
                    </div>
                    {emailWarning && !checkingEmail && <p className="text-xs text-destructive mt-1">{emailWarning}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone (optional)</label>
                    <div className="relative">
                      <Input
                        value={phone}
                        onChange={(e)=>handlePhoneInput(e.target.value)}
                        onBlur={() => void validatePhoneRemote(phone, { silent: true })}
                        placeholder="+923001234567"
                        className={`pr-9 bg-background/50 border-border focus:border-primary transition-colors ${phoneError ? "border-destructive" : ""}`}
                      />
                      {checkingPhone && (
                        <Loader2 className="w-4 h-4 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      )}
                    </div>
                    {phoneError && !checkingPhone && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
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
