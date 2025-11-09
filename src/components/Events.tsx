import { useState, useEffect } from "react";
import { Calendar, MapPin, ExternalLink, Shield, Brain, Rocket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { formatDate } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  location?: string;
  registration_link?: string;
  max_participants?: number;
  is_member_only: boolean;
  created_at?: string;
  payment_required?: boolean;
  fee_amount?: number;
  fee_currency?: string;
  category?: string;
  tags?: string[];
  registration_deadline?: string;
}

const Events = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: "all", label: "All Events" },
    { id: "cyber", label: "Cyber" },
    { id: "ai", label: "AI/ML" },
    { id: "fusion", label: "AI × Cyber Fusion" },
  ];

  // Map event types to categories
  const getEventCategory = (eventType: string, tags?: string[]): string => {
    if (tags && tags.some(tag => tag.toLowerCase().includes("fusion"))) return "fusion";
    if (tags && tags.some(tag => tag.toLowerCase().includes("cyber"))) return "cyber";
    if (tags && tags.some(tag => tag.toLowerCase().includes("ai") || tag.toLowerCase().includes("ml"))) return "ai";
    if (eventType.toLowerCase().includes("hackathon")) return "fusion";
    if (eventType.toLowerCase().includes("cyber")) return "cyber";
    if (eventType.toLowerCase().includes("ai") || eventType.toLowerCase().includes("ml")) return "ai";
    return "all";
  };

  // Get icon based on category
  const getIcon = (category: string) => {
    switch (category) {
      case "cyber": return Shield;
      case "ai": return Brain;
      case "fusion": return Rocket;
      default: return Calendar;
    }
  };

  // Load events from Supabase
  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .neq("event_type", "hackathon") // Exclude hackathons from landing page
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading events:", error);
          // Fallback to empty array
          setEvents([]);
        } else {
          setEvents(data || []);
        }
      } catch (e) {
        console.error("Failed to load events:", e);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  // Filter events by category
  const visible = activeCategory === "all"
    ? events
    : events.filter((e) => {
        const category = getEventCategory(e.event_type, e.tags);
        return category === activeCategory;
      });

  // Format badge text
  const getBadgeText = (event: Event): string => {
    if (event.payment_required && event.fee_amount) {
      return `Paid • ${event.fee_currency || "Rs."} ${event.fee_amount}`;
    }
    return "Free";
  };

  // Format date
  const formatEventDate = (dateString?: string): string => {
    if (!dateString) return "TBA";
    try {
      return formatDate(dateString);
    } catch {
      return "TBA";
    }
  };

  // Hardcoded fallback events (for initial load or if Supabase fails)
  const fallbackEvents = [
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

  // Use Supabase events if available, otherwise fallback
  const displayEvents = events.length > 0 ? visible : fallbackEvents.filter((e) => 
    activeCategory === "all" || e.category === activeCategory
  );

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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : displayEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No events available at the moment. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {displayEvents.map((event, index) => {
              // Handle both Supabase events and fallback events
              const isSupabaseEvent = 'id' in event && typeof event.id === 'string';
              const Icon = isSupabaseEvent ? getIcon(getEventCategory(event.event_type, event.tags)) : (event as any).icon;
              const category = isSupabaseEvent ? getEventCategory(event.event_type, event.tags) : (event as any).category;
              
              return (
                <div
                  key={isSupabaseEvent ? event.id : (event as any).id}
                  className="glass-panel-premium p-6 rounded-2xl animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center gap-2 text-sm text-foreground/90">
                      <Icon className="w-5 h-5 text-primary" />
                      {category.toUpperCase()}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {isSupabaseEvent ? getBadgeText(event) : (event as any).badge}
                    </Badge>
                  </div>

                  <h3 className="text-xl font-bold leading-tight mb-2">{event.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {event.description || (event as any).description}
                  </p>

                  {isSupabaseEvent ? (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-5">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-primary" />
                        {formatEventDate(event.start_date)}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-secondary" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <ul className="text-sm text-foreground/90 space-y-2 mb-4 list-disc list-inside">
                        {(event as any).points?.map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-primary" />
                          {(event as any).date}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-secondary" />
                          {(event as any).location}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                        <span>Audience: <span className="text-foreground/90 font-medium">{(event as any).audience}</span></span>
                        <span>Fee: <span className="text-foreground/90 font-medium">{(event as any).fee}</span></span>
                      </div>
                    </>
                  )}

                  <Button variant="glow" className="w-full" asChild>
                    <a href={isSupabaseEvent ? "#join" : (event as any).registrationLink}>
                      Register Now
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Events;
