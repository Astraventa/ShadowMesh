import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Eye, EyeOff, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";

interface MemberLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MemberLoginDialog({ open, onOpenChange }: MemberLoginDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<Date | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const [pendingMemberData, setPendingMemberData] = useState<any>(null);

  useEffect(() => {
    // Check for lock status
    const lockUntilStr = localStorage.getItem("shadowmesh_lock_until");
    if (lockUntilStr) {
      const lockTime = new Date(lockUntilStr);
      if (lockTime > new Date()) {
        setIsLocked(true);
        setLockUntil(lockTime);
      } else {
        localStorage.removeItem("shadowmesh_lock_until");
        localStorage.removeItem("shadowmesh_failed_attempts");
      }
    }

    const attempts = localStorage.getItem("shadowmesh_failed_attempts");
    if (attempts) {
      setFailedAttempts(parseInt(attempts, 10));
    }
  }, []);

  async function hashPassword(password: string, email: string): Promise<string> {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const saltData = encoder.encode(email.trim().toLowerCase() + "shadowmesh_salt");
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordData,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltData,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function verifyPassword(password: string, hash: string, email: string): Promise<boolean> {
    const passwordHash = await hashPassword(password, email);
    return passwordHash === hash;
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast({ title: "Missing fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }

    if (isLocked && lockUntil && lockUntil > new Date()) {
      const minutesLeft = Math.ceil((lockUntil.getTime() - new Date().getTime()) / 60000);
      toast({ title: "Account locked", description: `Too many failed attempts. Try again in ${minutesLeft} minute(s).`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Get member by email
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("email", loginEmail.trim().toLowerCase())
        .single();

      if (memberError || !memberData) {
        throw new Error("Member not found. Please ensure your application has been approved.");
      }

      // Check if password is set
      if (!memberData.password_hash) {
        toast({ 
          title: "Password not set", 
          description: "Please check your email for the password setup link, or use 'Forgot Password' to set one.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Verify password
      const isValid = await verifyPassword(loginPassword, memberData.password_hash, memberData.email);
      if (!isValid) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        localStorage.setItem("shadowmesh_failed_attempts", newAttempts.toString());

        if (newAttempts >= 3) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + 15);
          setIsLocked(true);
          setLockUntil(lockTime);
          localStorage.setItem("shadowmesh_lock_until", lockTime.toISOString());
          setShowForgotPassword(true);
          toast({ title: "Account locked", description: "Too many failed attempts. Account locked for 15 minutes.", variant: "destructive" });
        } else {
          toast({ 
            title: "Invalid password", 
            description: `Incorrect password. ${3 - newAttempts} attempt(s) remaining.`,
            variant: "destructive"
          });
        }
        setLoading(false);
        return;
      }

      // Check if 2FA is enabled
      if (memberData.two_factor_enabled || !!memberData.two_factor_secret) {
        setNeeds2FA(true);
        setPendingMemberData(memberData);
        setLoginPassword("");
        setLoading(false);
        return;
      }

      // Success - no 2FA
      localStorage.setItem("shadowmesh_authenticated", "true");
      localStorage.setItem("shadowmesh_member_email", loginEmail.trim().toLowerCase());
      localStorage.removeItem("shadowmesh_failed_attempts");
      localStorage.removeItem("shadowmesh_lock_until");
      
      toast({ title: "Welcome back!", description: "Redirecting to your portal..." });
      onOpenChange(false);
      navigate("/member-portal");
      window.location.reload();
    } catch (error: any) {
      console.error("Login error:", error);
      toast({ title: "Login failed", description: error.message || "An error occurred. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  }

  async function handle2FALogin() {
    if (twoFactorCode.length !== 6) {
      toast({ title: "Invalid code", description: "Please enter a 6-digit code.", variant: "destructive" });
      return;
    }

    setTwoFactorVerifying(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/two_factor_auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "verify",
          memberId: pendingMemberData?.id,
          otp: twoFactorCode.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({ title: "Verification failed", description: result.error || "Invalid 2FA code.", variant: "destructive" });
        setTwoFactorVerifying(false);
        return;
      }

      localStorage.setItem("shadowmesh_authenticated", "true");
      localStorage.setItem("shadowmesh_member_email", pendingMemberData?.email || loginEmail);
      localStorage.removeItem("shadowmesh_failed_attempts");
      localStorage.removeItem("shadowmesh_lock_until");
      
      toast({ title: "Welcome back!", description: "Redirecting to your portal..." });
      onOpenChange(false);
      navigate("/member-portal");
      window.location.reload();
    } catch (error: any) {
      console.error("2FA error:", error);
      toast({ title: "Verification failed", description: error.message || "An error occurred.", variant: "destructive" });
      setTwoFactorVerifying(false);
    }
  }

  async function handleForgotPassword() {
    if (!resetEmail.trim()) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/password_reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "request",
          email: resetEmail.trim().toLowerCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Still show generic message for security
        toast({ 
          title: "Reset link sent", 
          description: "If this email is registered, you will receive password reset instructions.",
        });
        setLoading(false);
        return;
      }

      toast({ 
        title: "Reset link sent", 
        description: result.message || "If this email is registered, you will receive password reset instructions.",
      });
      setShowForgotPassword(false);
      setResetEmail("");
      setLoading(false);
    } catch (error: any) {
      // Still show generic message for security
      toast({ 
        title: "Reset link sent", 
        description: "If this email is registered, you will receive password reset instructions.",
      });
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center">
            {needs2FA ? "Two-Factor Authentication" : "Member Login"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {needs2FA
              ? "Enter the 6-digit code from your authenticator app"
              : "Sign in to access your member portal"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {needs2FA ? (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  2FA Code
                </label>
                <Input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setTwoFactorCode(val);
                  }}
                  placeholder="000000"
                  maxLength={6}
                  disabled={twoFactorVerifying}
                  autoComplete="one-time-code"
                  className="text-center text-2xl tracking-widest font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && twoFactorCode.length === 6) {
                      handle2FALogin();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                onClick={handle2FALogin}
                disabled={twoFactorCode.length !== 6 || twoFactorVerifying || loading}
              >
                {twoFactorVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Login"
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setNeeds2FA(false);
                  setTwoFactorCode("");
                  setPendingMemberData(null);
                  setLoginEmail("");
                  setLoginPassword("");
                }}
              >
                Back to Login
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value.toLowerCase())}
                  placeholder="your.email@example.com"
                  disabled={loading || isLocked}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && loginEmail && loginPassword && !loading && !isLocked) {
                      handleLogin();
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading || isLocked}
                    className="pr-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && loginEmail && loginPassword && !loading && !isLocked) {
                        handleLogin();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isLocked && lockUntil && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                  <p className="text-sm text-yellow-400 mb-2">
                    Account locked after 3 failed attempts. Try again in {Math.ceil((lockUntil.getTime() - new Date().getTime()) / 60000)} minute(s).
                  </p>
                  {!showForgotPassword && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </Button>
                  )}
                </div>
              )}

              {showForgotPassword && (
                <div className="p-3 bg-muted/50 border rounded-md space-y-2">
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && resetEmail && !loading) {
                        handleForgotPassword();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleForgotPassword}
                      disabled={loading || !resetEmail.trim()}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetEmail("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!isLocked && !showForgotPassword && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </Button>
              )}

              <Button
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                onClick={handleLogin}
                disabled={loading || isLocked || !loginEmail.trim() || !loginPassword.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                New to ShadowMesh? <a href="#join" className="text-primary hover:underline" onClick={() => onOpenChange(false)}>Apply to join</a>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

