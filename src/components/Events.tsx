import { useState } from "react";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
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
      title: "CTF Championship 2025",
      category: "cyber",
      date: "March 15, 2025",
      location: "RIUF Campus",
      description: "Compete in capture-the-flag challenges testing your hacking and security skills.",
      registrationLink: "https://forms.google.com/shadowmesh-ctf",
      badge: "Upcoming",
    },
    {
      id: 2,
      title: "AI Model Building Workshop",
      category: "ai",
      date: "April 2, 2025",
      location: "Lab 4A",
      description: "Hands-on workshop on building and training neural networks from scratch.",
      registrationLink: "https://forms.google.com/shadowmesh-ai-workshop",
      badge: "Registration Open",
    },
    {
      id: 3,
      title: "Security-AI Summit",
      category: "fusion",
      date: "May 10, 2025",
      location: "Main Auditorium",
      description: "Explore the intersection of AI and cybersecurity with industry experts.",
      registrationLink: "https://forms.google.com/shadowmesh-summit",
      badge: "Featured",
    },
    {
      id: 4,
      title: "Ethical Hacking Bootcamp",
      category: "cyber",
      date: "June 5-7, 2025",
      location: "Online",
      description: "3-day intensive training on penetration testing and security auditing.",
      registrationLink: "https://forms.google.com/shadowmesh-bootcamp",
      badge: "Limited Seats",
    },
  ];

  const filteredEvents = activeCategory === "all" 
    ? events 
    : events.filter(event => event.category === activeCategory);

  return (
    <section id="events" className="py-20 md:py-32 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Upcoming</span> Events
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join workshops, hackathons, and talks that push the boundaries of cyber and AI innovation.
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
        <div className="grid md:grid-cols-2 gap-6">
          {filteredEvents.map((event, index) => (
            <div
              key={event.id}
              className="glass-panel-premium p-6 rounded-xl hover:glow-border-premium premium-hover group cursor-pointer animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex justify-between items-start mb-4">
                <Badge variant="secondary" className="text-xs">
                  {event.badge}
                </Badge>
              </div>

              <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                {event.title}
              </h3>

              <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-secondary" />
                  <span>{event.location}</span>
                </div>
              </div>

              <p className="text-muted-foreground mb-6">
                {event.description}
              </p>

              <Button variant="glow" className="w-full" asChild>
                <a href={event.registrationLink} target="_blank" rel="noopener noreferrer">
                  Register Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Events;
