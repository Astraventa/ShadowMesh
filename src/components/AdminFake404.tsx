import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock } from "lucide-react";

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
      saveLoginAttempt(true);
      sessionStorage.setItem("shadowmesh_admin_basic_auth", "1");
      sessionStorage.setItem("shadowmesh_admin_authenticated_at", Date.now().toString());
      onAuthenticated();
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
            <DialogTitle className="text-2xl text-center">Admin Authentication</DialogTitle>
            <DialogDescription className="text-center">
              Enter your credentials to access the admin portal
            </DialogDescription>
          </DialogHeader>

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
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminFake404;

