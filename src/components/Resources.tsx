import { BookOpen, Cpu, ExternalLink, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Link } from "react-router-dom";

const Resources = () => {
  const resourcePacks = [
    {
      id: 'cyber',
      icon: BookOpen,
      title: "Cybersecurity Toolkit",
      description: "Essential tools, frameworks, and guides for ethical hacking and security research.",
      items: [
        { title: "Security Tools", desc: "Top OSS tooling for testing.", link: "/resources/security-tools" },
        { title: "Roadmaps", desc: "Learning paths for all levels.", link: "/resources/roadmaps" },
        { title: "Frameworks", desc: "OWASP, MITRE, NIST collections.", link: "/resources/frameworks" },
        { title: "Databases", desc: "Vuln DBs and exploit references.", link: "/resources/databases" },
      ],
      access: 'public',
      gradient: "from-cyan-400 to-blue-600",
    },
    {
      id: 'ai',
      icon: Cpu,
      title: "AI Starter Pack",
      description: "Datasets, models, and resources to kickstart your AI and machine learning journey.",
      items: [
        { title: "Datasets", desc: "Curated public data sources.", link: "/resources/ai-datasets" },
        { title: "Models", desc: "Starter and finetuning models.", link: "/resources/ai-models" },
        { title: "Frameworks", desc: "PyTorch, TF, JAX quickstarts.", link: "/resources/ai-frameworks" },
        { title: "Papers", desc: "Must-read applied research.", link: "/resources/ai-papers" },
      ],
      access: 'public',
      gradient: "from-fuchsia-500 to-indigo-500",
    },
    {
      id: 'fusion',
      icon: Shield,
      title: "Fusion Lab (AI × Cyber)",
      description: "Where AI meets Security: anomaly detection kits, red/blue-team datasets, and defense blueprints.",
      items: [
        { title: "Threat Detection", desc: "Anomaly & IDS examples.", link: "/resources/fusion-threat-detection" },
        { title: "Sim Playbooks", desc: "Attack/defense simulations.", link: "/resources/fusion-sim-playbooks" },
        { title: "Dashboards", desc: "Security analytics templates.", link: "/resources/fusion-dashboards" },
        { title: "SDKs", desc: "API integrations & SDKs.", link: "/resources/fusion-sdks" },
      ],
      access: 'members',
      gradient: "from-pink-500 to-purple-600",
    },
  ] as const;

  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="resources" className="py-24 md:py-32 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Learning</span> Resources
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Curated toolkits and guides to accelerate your journey across Cybersecurity, AI/ML, and the Fusion of both.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {["CTF", "Red Team", "Datasets", "Models", "Roadmaps", "Dashboards"].map((t) => (
            <span key={t} className="glass-panel px-3 py-1.5 rounded-full text-xs text-foreground/90">
              {t}
            </span>
          ))}
        </div>

        {/* Resource Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {resourcePacks.map((pack, index) => {
            const Icon = pack.icon;
            const isLocked = pack.access === 'members';
            return (
              <div
                key={pack.id}
                className="glass-panel-premium p-8 rounded-2xl animate-fade-in-up"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Icon */}
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${pack.gradient} mb-6`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Title & Description */}
                <h3 className="text-2xl font-bold mb-3 flex items-center gap-2">
                  {pack.title}
                  {isLocked && <Lock className="w-4 h-4 text-white/80" />}
                </h3>
                <p className="text-muted-foreground mb-6">{pack.description}</p>

                {/* CTA Button → Modal */}
                <Dialog open={openId === pack.id} onOpenChange={(o)=> setOpenId(o ? pack.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="glow" className="w-full">
                      {isLocked ? 'View Details' : 'Access Resources'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-panel-premium max-w-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        {pack.title} {isLocked && <Lock className="w-4 h-4" />}
                      </DialogTitle>
                      <DialogDescription>{pack.description}</DialogDescription>
                    </DialogHeader>

                    {isLocked ? (
                      <div className="py-4 space-y-6">
                        <div className="rounded-xl p-6 border border-border/50 bg-card/60 text-center">
                          <p className="mb-4 text-foreground">🔒 Exclusive content for ShadowMesh members.</p>
                          <div className="flex gap-3 justify-center">
                            <Button asChild variant="cyber"><a href="#join">Join ShadowMesh</a></Button>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {pack.items.map((it) => (
                            <div key={it.title} className="rounded-xl p-4 border border-border/50 bg-card/60">
                              <h4 className="font-semibold mb-1">{it.title}</h4>
                              <p className="text-xs text-muted-foreground mb-3">{it.desc}</p>
                              <Button size="sm" asChild variant="outline">
                                <Link to={it.link} onClick={() => setOpenId(null)}>
                                  Open
                                </Link>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
                        {pack.items.map((it) => (
                          <div key={it.title} className="rounded-xl p-4 border border-border/50 bg-card/60">
                            <h4 className="font-semibold mb-1">{it.title}</h4>
                            <p className="text-xs text-muted-foreground mb-3">{it.desc}</p>
                            <Button size="sm" asChild variant="outline">
                              <Link to={it.link} onClick={() => setOpenId(null)}>
                                Open
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Resources;
