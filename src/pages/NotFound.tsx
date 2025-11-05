import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.ctrlKey && (key === "k" || key === "a")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (username === "zeeshanjay" && password === "haiderjax###") {
      setError("");
      setOpen(false);
      setUsername("");
      setPassword("");
      navigate("/shadow-ops-portal");
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Administrator Access</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAuth} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Username</label>
              <Input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button type="submit">Sign in</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotFound;
