import { Shield, Brain, Users } from "lucide-react";

const About = () => {
  const pillars = [
    {
      icon: Shield,
      title: "Cyber Defense",
      description: "Master the art of digital protection, ethical hacking, and security research.",
      gradient: "from-primary to-primary/50",
    },
    {
      icon: Brain,
      title: "AI Innovation",
      description: "Explore machine learning, neural networks, and intelligent systems.",
      gradient: "from-secondary to-secondary/50",
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Unite with dreamers and doers to shape tomorrow's digital frontier.",
      gradient: "from-accent to-accent/50",
    },
  ];

  return (
    <section id="about" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 cyber-grid opacity-10"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold">
              <span className="text-gradient">About</span> ShadowMesh RIUF
            </h2>
            
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p className="text-lg">
                A <span className="text-primary font-semibold">Cyber & AI innovation community</span> built by students of Riphah International University Faisalabad.
              </p>
              <p>
                We unite hackers, researchers, and dreamers who are passionate about shaping tomorrow's digital frontier. From cybersecurity challenges to AI breakthroughs, we're pushing boundaries and building the future.
              </p>
              <p className="text-foreground font-medium italic">
                "In the mesh, every mind matters. Every innovation echoes."
              </p>
            </div>
          </div>

          {/* Right: Pillars */}
          <div className="space-y-6">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="glass-panel-premium p-6 rounded-xl hover:glow-border-premium premium-hover group cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${pillar.gradient} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-6 h-6 text-background" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
