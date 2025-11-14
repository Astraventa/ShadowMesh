import { useState, useEffect } from "react";
import { Menu, X, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import MemberLoginDialog from "@/components/MemberLoginDialog";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Check if user is authenticated
    const authenticated = localStorage.getItem("shadowmesh_authenticated");
    const memberEmail = localStorage.getItem("shadowmesh_member_email");
    setIsMember(authenticated === "true" && !!memberEmail);
  }, []);

  const navLinks = [
    { name: "Home", href: "#home" },
    { name: "About", href: "#about" },
    { name: "Events", href: "#events" },
    { name: "Join Us", href: "#join" },
    { name: "Resources", href: "#resources" },
    { name: "Gallery", href: "#gallery" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "glass-panel shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#home" aria-label="ShadowMesh home" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="ShadowMesh Logo"
              className="h-12 md:h-14 w-auto object-contain drop-shadow-md select-none"
              loading="eager"
              decoding="async"
              draggable="false"
            />
            <img
              src="/text.png"
              alt="ShadowMesh Wordmark"
              className="h-8 md:h-10 w-auto object-contain opacity-95"
              loading="eager"
              decoding="async"
              draggable="false"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-5 py-2.5 text-[15px] tracking-wide font-semibold text-muted-foreground hover:text-primary transition-all duration-300 relative group"
              >
                {link.name}
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary/80 shadow-[0_0_10px_hsl(var(--primary))] transition-all duration-300 group-hover:w-full"></span>
              </a>
            ))}
            {isMember ? (
              <a
                href="/member-portal"
                className="ml-4 px-5 py-2.5 text-[15px] tracking-wide font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-all duration-300 flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Portal
              </a>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLoginDialog(true)}
                className="ml-4 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-all duration-300 flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Member Login
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden glass-panel mt-2 rounded-lg p-4 space-y-2 animate-fade-in-up">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all duration-300"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <div className="pt-2 border-t border-border/50 mt-2">
              {isMember ? (
                <a
                  href="/member-portal"
                  className="block px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-md transition-all duration-300 flex items-center gap-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <LogIn className="w-4 h-4" />
                  Member Portal
                </a>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowLoginDialog(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-all duration-300 flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Member Login
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Member Login Dialog */}
      <MemberLoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </nav>
  );
};

export default Navigation;
