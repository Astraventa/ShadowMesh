import { Code2 } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative border-t border-border/50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo/Brand */}
          <div className="text-center">
            <h3 className="text-2xl font-bold">
              <span className="text-gradient">ShadowMesh</span> RIUF
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              A Cyber & AI Innovation Community
            </p>
          </div>

          {/* Taglines */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              Powered by <span className="text-primary">Curiosity</span>. Secured by <span className="text-secondary">Code</span>.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#about" className="text-muted-foreground hover:text-primary transition-colors">About</a>
            <a href="#events" className="text-muted-foreground hover:text-primary transition-colors">Events</a>
            <a href="#join" className="text-muted-foreground hover:text-primary transition-colors">Join Us</a>
            <a href="#resources" className="text-muted-foreground hover:text-primary transition-colors">Resources</a>
            <a href="#gallery" className="text-muted-foreground hover:text-primary transition-colors">Gallery</a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</a>
          </div>

          {/* Divider */}
          <div className="w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

          {/* Copyright */}
          <div className="text-center text-sm text-muted-foreground">
            <p className="flex items-center justify-center gap-2">
              <Code2 className="w-4 h-4 text-primary" />
              © 2025 ShadowMesh RIUF — All rights reserved
            </p>
            <p className="mt-2 text-xs">
              Riphah International University Faisalabad
            </p>
          </div>
        </div>
      </div>

      {/* Background Glow Effect */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
    </footer>
  );
};

export default Footer;
