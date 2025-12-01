import { Shield, Brain, Users } from "lucide-react";

const About = () => {
  const pillars = [
    {
      icon: Shield,
      title: "Cyber Defense",
      description: "Master ethical hacking, digital forensics, and next-gen security.",
      gradient: "from-cyan-400 to-blue-600",
      orb: "bg-cyan-400/80",
    },
    {
      icon: Brain,
      title: "AI Innovation",
      description: "Explore machine learning, LLMs, automation, and intelligent systems.",
      gradient: "from-fuchsia-500 to-indigo-500",
      orb: "bg-fuchsia-500/80",
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Connect with high-performers across universities, build teams, solve problems, and shape the future.",
      gradient: "from-pink-500 to-purple-500",
      orb: "bg-pink-500/80",
    },
  ];

  return (
    <section id="about" className="py-24 md:py-32 relative overflow-visible">
      <div className="absolute inset-0 pointer-events-none select-none opacity-30 -z-10">
        <div className="absolute left-0 top-14 w-2 h-2/3 bg-gradient-to-b from-cyan-400 via-fuchsia-500 to-pink-600 rounded-full blur-2xl"></div>
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-20 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight">
              <span className="heading-with-bar bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-pink-500 text-transparent bg-clip-text">About</span>
            </h2>
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed font-medium">
              <p>
                ShadowMesh is a <span className="text-cyan-400 font-bold">Cyber & AI innovation collective</span> built by <span className="text-fuchsia-400 font-semibold">emerging engineers, researchers, and creators</span>.
              </p>
              <p>
                We unite <span className="text-pink-400 font-semibold">hackers</span>, <span className="text-cyan-400 font-semibold">builders</span>, and <span className="text-fuchsia-400 font-semibold">visionaries</span> shaping the future of intelligent security.
              </p>
            </div>
            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-fuchsia-900 border-l-4 border-fuchsia-400">
              <p className="italic text-xl font-semibold text-fuchsia-200/90">"In the mesh, every mind matters. Every innovation echoes."</p>
            </div>
          </div>

          {/* Right: Premium Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 md:gap-8 lg:gap-10">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className={`rounded-2xl shadow-xl p-5 flex flex-col items-center text-center transition-all min-w-[180px] max-w-[220px] mx-auto bg-gradient-to-br ${pillar.gradient} backdrop-blur-md border-2 border-white/10 relative overflow-hidden`} style={{ zIndex: 10 - i }}>
                  <span className={`mb-4 w-14 h-14 flex items-center justify-center rounded-full ${pillar.orb} bg-opacity-60 border-2 border-white/30 shadow-md`}>
                    <Icon className="w-8 h-8 text-white/90 drop-shadow-[0_1px_5px_rgba(255,255,255,0.18)]" />
                  </span>
                  <h3 className="text-lg font-bold text-white mb-1 tracking-tight" style={{textShadow: '0 2px 10px rgba(0,0,0,0.14)'}}>{pillar.title}</h3>
                  <p className="text-sm text-white/90 font-normal leading-relaxed" style={{textShadow: '0 2px 8px rgba(0,0,0,0.13)'}}>{pillar.description}</p>
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
