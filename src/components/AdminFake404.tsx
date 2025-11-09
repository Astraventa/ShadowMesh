import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Shield } from "lucide-react";

interface AdminFake404Props {
  onAuthenticated: () => void;
}

// Rate limiting and brute force protection
interface LoginAttempt {
  timestamp: number;
  ip: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 60 * 1000; // 1 minute window

function getClientIP(): string {
  // In production, this would come from headers, but for client-side we use a combination
  return `${navigator.userAgent.slice(0, 20)}-${screen.width}x${screen.height}`;
}

// Client-side TOTP verification (simplified)
// Note: In production, this should be done server-side via edge function
async function verifyTOTPClient(secret: string, code: string): Promise<boolean> {
  try {
    // Base32 decode
    const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const output: number[] = [];
    
    for (let i = 0; i < secret.length; i++) {
      value = (value << 5) | base32chars.indexOf(secret[i].toUpperCase());
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    
    const key = new Uint8Array(output);
    const timeStep = 30;
    const now = Math.floor(Date.now() / 1000 / timeStep);
    
    // Check current time step and adjacent windows (for clock skew)
    for (let i = -1; i <= 1; i++) {
      const testTime = now + i;
      const testCounter = new Uint8Array(8);
      let tempTime = testTime;
      
      for (let j = 7; j >= 0; j--) {
        testCounter[j] = tempTime & 0xff;
        tempTime >>>= 8;
      }
      
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      );
      
      const signature = await crypto.subtle.sign("HMAC", cryptoKey, testCounter);
      const sigArray = new Uint8Array(signature);
      
      const offset = sigArray[19] & 0x0f;
      const testCode = ((sigArray[offset] & 0x7f) << 24) |
                       ((sigArray[offset + 1] & 0xff) << 16) |
                       ((sigArray[offset + 2] & 0xff) << 8) |
                       (sigArray[offset + 3] & 0xff);
      
      const testCodeStr = (testCode % 1000000).toString().padStart(6, "0");
      
      if (testCodeStr === code) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

function AdminFake404({ onAuthenticated }: AdminFake404Props) {
  const navigate = useNavigate();
  const [secretClicks, setSecretClicks] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState(MAX_ATTEMPTS);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const secretAreaRef = useRef<HTMLDivElement>(null);
  
  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);

  // Load login attempts from localStorage
  const getLoginAttempts = (): LoginAttempt[] => {
    try {
      const stored = localStorage.getItem("shadowmesh_admin_login_attempts");
      if (!stored) return [];
      const attempts: LoginAttempt[] = JSON.parse(stored);
      const now = Date.now();
      // Filter out old attempts outside the window
      return attempts.filter(attempt => now - attempt.timestamp < ATTEMPT_WINDOW);
    } catch {
      return [];
    }
  };

  const saveLoginAttempt = (success: boolean) => {
    const attempts = getLoginAttempts();
    const ip = getClientIP();
    
    if (success) {
      // Clear attempts on success
      localStorage.removeItem("shadowmesh_admin_login_attempts");
      localStorage.removeItem("shadowmesh_admin_lockout");
      setRemainingAttempts(MAX_ATTEMPTS);
      setIsLocked(false);
      setLockUntil(null);
      return;
    }

    // Add failed attempt
    attempts.push({ timestamp: Date.now(), ip });
    localStorage.setItem("shadowmesh_admin_login_attempts", JSON.stringify(attempts));

    // Check if we should lock
    if (attempts.length >= MAX_ATTEMPTS) {
      const lockUntilTime = Date.now() + LOCKOUT_DURATION;
      localStorage.setItem("shadowmesh_admin_lockout", lockUntilTime.toString());
      setIsLocked(true);
      setLockUntil(lockUntilTime);
      setError(`Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`);
    } else {
      setRemainingAttempts(MAX_ATTEMPTS - attempts.length);
      setError(`Invalid credentials. ${MAX_ATTEMPTS - attempts.length} attempts remaining.`);
    }
  };

  // Check lockout status on mount
  useEffect(() => {
    const lockoutUntil = localStorage.getItem("shadowmesh_admin_lockout");
    if (lockoutUntil) {
      const lockTime = parseInt(lockoutUntil, 10);
      const now = Date.now();
      if (now < lockTime) {
        setIsLocked(true);
        setLockUntil(lockTime);
        const remaining = Math.ceil((lockTime - now) / 60000);
        setError(`Account locked. Try again in ${remaining} minutes.`);
      } else {
        localStorage.removeItem("shadowmesh_admin_lockout");
        localStorage.removeItem("shadowmesh_admin_login_attempts");
      }
    }
  }, []);

  // Reset secret clicks after 3 seconds
  useEffect(() => {
    if (secretClicks > 0 && secretClicks < 3) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      clickTimeoutRef.current = setTimeout(() => {
        setSecretClicks(0);
      }, 3000);
    }
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [secretClicks]);

  const handleSecretClick = (e: React.MouseEvent) => {
    // Secret click area: top-right corner (invisible)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if click is in top-right corner (last 100px from right, first 100px from top)
    if (x >= rect.width - 100 && y <= 100) {
      const newCount = secretClicks + 1;
      setSecretClicks(newCount);
      
      if (newCount >= 3) {
        setShowLogin(true);
        setSecretClicks(0);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLocked) {
      if (lockUntil && Date.now() < lockUntil) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 60000);
        setError(`Account locked. Try again in ${remaining} minutes.`);
        return;
      } else {
        setIsLocked(false);
        setLockUntil(null);
        localStorage.removeItem("shadowmesh_admin_lockout");
      }
    }

    // Validate credentials
    if (username === "zeeshanjay" && password === "haiderjax###") {
      // Check if 2FA is enabled
      const admin2FAEnabled = localStorage.getItem("shadowmesh_admin_2fa_enabled") === "true";
      
      if (admin2FAEnabled) {
        // Require 2FA code
        setNeeds2FA(true);
        saveLoginAttempt(true); // Don't count as failed, just need 2FA
      } else {
        // No 2FA, authenticate directly
        saveLoginAttempt(true);
        sessionStorage.setItem("shadowmesh_admin_basic_auth", "1");
        sessionStorage.setItem("shadowmesh_admin_authenticated_at", Date.now().toString());
        onAuthenticated();
      }
    } else {
      saveLoginAttempt(false);
      setUsername("");
      setPassword("");
    }
  };

  // Update lockout timer
  useEffect(() => {
    if (isLocked && lockUntil) {
      const interval = setInterval(() => {
        const now = Date.now();
        if (now >= lockUntil) {
          setIsLocked(false);
          setLockUntil(null);
          localStorage.removeItem("shadowmesh_admin_lockout");
          setError("");
        } else {
          const remaining = Math.ceil((lockUntil - now) / 60000);
          setError(`Account locked. Try again in ${remaining} minutes.`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLocked, lockUntil]);

  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900"
      onClick={handleSecretClick}
      ref={secretAreaRef}
    >
      {/* Fake 404 Page */}
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-400 dark:text-gray-600">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">
          Page Not Found
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The page you are looking for does not exist.
        </p>
        <Button
          onClick={() => navigate("/")}
          className="mt-6"
          variant="outline"
        >
          Go Home
        </Button>
      </div>

      {/* Secret Login Dialog */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl text-center">
              {needs2FA ? "Two-Factor Authentication" : "Admin Authentication"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {needs2FA 
                ? "Enter the 6-digit code from your authenticator app"
                : "Enter your credentials to access the admin portal"}
            </DialogDescription>
          </DialogHeader>

          {!needs2FA ? (
            <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant={isLocked ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isLocked && remainingAttempts < MAX_ATTEMPTS && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before lockout
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLocked}
                autoComplete="username"
                className="bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked}
                autoComplete="current-password"
                className="bg-background"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowLogin(false);
                  setUsername("");
                  setPassword("");
                  setError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLocked || !username || !password}
                className="flex-1"
              >
                {isLocked ? "Locked" : "Login"}
              </Button>
            </DialogFooter>
          </form>
          ) : (
            <form onSubmit={handle2FAVerification} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="2fa-code" className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  2FA Code
                </label>
                <Input
                  id="2fa-code"
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
                  className="bg-background text-center text-2xl tracking-widest font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNeeds2FA(false);
                    setTwoFactorCode("");
                    setError("");
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorCode.length !== 6 || twoFactorVerifying}
                  className="flex-1"
                >
                  {twoFactorVerifying ? "Verifying..." : "Verify & Login"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminFake404;

