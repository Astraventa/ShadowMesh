import { BookOpen, Cpu, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const Resources = () => {
  const resourcePacks = [
    {
      icon: BookOpen,
      title: "Cybersecurity Toolkit",
      description: "Essential tools, frameworks, and guides for ethical hacking and security research.",
      items: [
        "CTF Challenges & Writeups",
        "Security Testing Tools",
        "Vulnerability Databases",
        "Learning Roadmaps",
      ],
      link: "#",
      gradient: "from-primary to-primary/50",
    },
    {
      icon: Cpu,
      title: "AI Starter Pack",
      description: "Datasets, models, and resources to kickstart your AI and machine learning journey.",
      items: [
        "Open Source Datasets",
        "Pre-trained Models",
        "ML Frameworks Guide",
        "Research Papers",
      ],
      link: "#",
      gradient: "from-secondary to-secondary/50",
    },
  ];

  return (
    <section id="resources" className="py-20 md:py-32 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Learning</span> Resources
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Curated toolkits and guides to accelerate your cyber and AI learning journey.
          </p>
        </div>

        {/* Resource Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {resourcePacks.map((pack, index) => {
            const Icon = pack.icon;
            return (
              <div
                key={pack.title}
                className="glass-panel-premium p-8 rounded-2xl hover:glow-border-premium premium-hover group animate-fade-in-up"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                {/* Icon */}
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${pack.gradient} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-8 h-8 text-background" />
                </div>

                {/* Title & Description */}
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {pack.title}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {pack.description}
                </p>

                {/* Items List */}
                <ul className="space-y-2 mb-6">
                  {pack.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button variant="glow" className="w-full group-hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]" asChild>
                  <a href={pack.link}>
                    Access Resources
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Learning Roadmap Section */}
        <div className="mt-16 text-center">
          <div className="glass-panel-premium p-8 rounded-2xl max-w-3xl mx-auto glow-border-premium animate-glow-pulse">
            <h3 className="text-2xl font-bold mb-4">
              <span className="text-gradient">Learning Roadmap</span>
            </h3>
            <p className="text-muted-foreground mb-6">
              Not sure where to start? Follow our structured learning paths designed for beginners to advanced practitioners.
            </p>
            <Button variant="cyber" size="lg">
              View Roadmap
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Resources;
