import { useState } from "react";
import { Calendar, MapPin, ExternalLink, Shield, Brain, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Events = () => {
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = [
    { id: "all", label: "All Events" },
    { id: "cyber", label: "Cyber" },
    { id: "ai", label: "AI/ML" },
    { id: "fusion", label: "AI × Cyber Fusion" },
  ];

  const events = [
    {
      id: 1,
      title: "Workshop 1 — Cybersecurity Foundations: “Into the Breach”",
      category: "cyber",
      date: "TBA",
      location: "RIUF Campus",
      badge: "Free • 1 Day (3 Hours)",
      icon: Shield,
      description:
        "Hands-on cybersecurity essentials: network analysis, malware basics, web exploitation, and ethical hacking with real-world examples.",
      points: [
        "How real attacks happen — and how to secure systems",
        "Wireshark, Burp Suite, OWASP Top 10",
        "Intro to AI‑driven threat detection",
      ],
      audience: "Beginners & Cybersecurity Enthusiasts",
      fee: "Free (registered students)",
      registrationLink: "#join",
    },
    {
      id: 2,
      title: "Workshop 2 — AI & Machine Learning for Innovators",
      category: "ai",
      date: "TBA",
      location: "RIUF Labs",
      badge: "Free • 1 Day (3 Hours)",
      icon: Brain,
      description:
        "Explore AI/ML from model building to intelligent automation. Practice with tools used in cybersecurity and smart systems.",
      points: [
        "Python, data preprocessing, basic ML models",
        "AI tools for anomaly detection",
        "Integrating AI APIs (Gemini, OpenAI, HuggingFace)",
      ],
      audience: "Beginners & AI Enthusiasts",
      fee: "Free (registered students)",
      registrationLink: "#join",
    },
    {
      id: 3,
      title: "Main Hackathon — ShadowMesh Launch Series (AI × Cyber Fusion)",
      category: "fusion",
      date: "TBA",
      location: "Main Auditorium",
      badge: "Paid • Rs. 500 per person",
      icon: Rocket,
      description:
        "Teams of AI and Cyber students build futuristic defense tools — where hackers and innovators mesh minds.",
      points: [
        "AI‑powered security systems, threat dashboards",
        "Cyber‑attack simulation with AI defense",
        "Secure automation / bot detection",
      ],
      audience: "Teams (≥1 Cyber + ≥1 AI/ML)",
      fee: "Rs. 500 (includes workshops + hackathon)",
      registrationLink: "#join",
    },
  ];

  const visible =
    activeCategory === "all"
      ? events
      : events.filter((e) => e.category === activeCategory);

  return (
    <section id="events" className="py-24 md:py-32 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Upcoming</span> Events
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Two focused workshops + one flagship hackathon. Choose your path — Cyber, AI/ML, or the Fusion Challenge.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              onClick={() => setActiveCategory(category.id)}
              className="transition-all duration-300"
            >
              {category.label}
            </Button>
          ))}
        </div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {visible.map((event, index) => {
            const Icon = event.icon;
            return (
              <div
                key={event.id}
                className="glass-panel-premium p-6 rounded-2xl animate-fade-in-up"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground/90">
                    <Icon className="w-5 h-5 text-primary" />
                    {event.category.toUpperCase()}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {event.badge}
                  </Badge>
                </div>

                <h3 className="text-xl font-bold leading-tight mb-2">{event.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{event.description}</p>

                <ul className="text-sm text-foreground/90 space-y-2 mb-4 list-disc list-inside">
                  {event.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-5">
                  <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4 text-primary" />{event.date}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4 text-secondary" />{event.location}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>Audience: <span className="text-foreground/90 font-medium">{event.audience}</span></span>
                  <span>Fee: <span className="text-foreground/90 font-medium">{event.fee}</span></span>
                </div>

                <Button variant="glow" className="w-full" asChild>
                  <a href={event.registrationLink}>
                    Register Now
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Events;
