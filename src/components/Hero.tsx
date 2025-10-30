import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-cyber-bg.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/70"></div>
      </div>

      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 cyber-grid opacity-30"></div>

      {/* Floating Particles Animation */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              opacity: 0.3 + Math.random() * 0.3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 animate-fade-in-up">
          <span className="text-gradient glow-text">Where Hackers and Innovators</span>
          <br />
          <span className="text-foreground">Mesh Minds.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          A fusion of <span className="text-primary font-semibold">Cybersecurity</span>, <span className="text-secondary font-semibold">Artificial Intelligence</span>, and <span className="text-accent font-semibold">Human Ingenuity</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Button size="lg" variant="cyber" asChild>
            <a href="#join">Join the Network</a>
          </Button>
          <Button size="lg" variant="glow" asChild>
            <a href="#events">Explore Events</a>
          </Button>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <a href="#about" className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors">
            <span className="text-sm mb-2">Scroll to explore</span>
            <ChevronDown className="w-6 h-6 animate-pulse" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
