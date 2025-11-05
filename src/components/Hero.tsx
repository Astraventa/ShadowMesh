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
      <div className="relative z-10 container mx-auto px-4 text-center flex flex-col justify-center items-center min-h-[75vh] mt-12">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 hero-font hero-prism-text animate-fade-in-up tracking-tight">
          Where Hackers and Innovators
          <br />
          Mesh Minds.
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          A fusion of <span className="text-primary font-semibold">Cybersecurity</span>, <span className="text-secondary font-semibold">Artificial Intelligence</span>, and <span className="text-accent font-semibold">Human Ingenuity</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <a href="#join" className="cyber-btn-gradient px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:scale-105 transition-transform">Join the Network</a>
          <a href="#events" className="glass-btn-glow px-8 py-3 rounded-lg font-bold text-lg border-2 border-primary shadow-lg hover:border-accent hover:scale-105 transition-transform">Explore Events</a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
