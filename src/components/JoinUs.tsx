import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const JoinUs = () => {
  return (
    <section id="join" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Be Part of the Revolution</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">Join</span> ShadowMesh
            </h2>
            <p className="text-muted-foreground text-lg mb-3">
              Become a member and start your journey in Cyber & AI innovation.
            </p>
            <div className="flex justify-center gap-6 text-xl font-bold">
              <span className="text-primary animate-float">Learn.</span>
              <span className="text-secondary animate-float" style={{ animationDelay: "0.5s" }}>Build.</span>
              <span className="text-accent animate-float" style={{ animationDelay: "1s" }}>Defend.</span>
            </div>
          </div>

          {/* Form */}
          <div className="glass-panel p-8 rounded-2xl glow-border">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <Input 
                    placeholder="John Doe" 
                    className="bg-background/50 border-border focus:border-primary focus:glow-border transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input 
                    type="email" 
                    placeholder="john@example.com" 
                    className="bg-background/50 border-border focus:border-primary focus:glow-border transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Institution / Affiliation <span className="text-muted-foreground text-xs">(optional)</span></label>
                <Input 
                  placeholder="e.g., Riphah International University, NUST, UET, or Independent" 
                  className="bg-background/50 border-border focus:border-primary focus:glow-border transition-all"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Area of Interest</label>
                  <Select>
                    <SelectTrigger className="bg-background/50 border-border focus:border-primary focus:glow-border transition-all">
                      <SelectValue placeholder="Select your interest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
                      <SelectItem value="ai-ml">AI/ML</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Skill Level</label>
                  <Select>
                    <SelectTrigger className="bg-background/50 border-border focus:border-primary focus:glow-border transition-all">
                      <SelectValue placeholder="Select your level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Why do you want to join?</label>
                <Textarea 
                  placeholder="Tell us about your passion for Cyber & AI, what you hope to learn, and how you want to contribute to the community..." 
                  rows={4}
                  className="bg-background/50 border-border focus:border-primary focus:glow-border transition-all resize-none"
                />
              </div>

              <Button type="submit" size="lg" variant="cyber" className="w-full">
                Submit Application
              </Button>
            </form>
          </div>

          {/* Info Text */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            By joining, you'll get access to exclusive workshops, mentorship, and networking opportunities.
          </p>
        </div>
      </div>
    </section>
  );
};

export default JoinUs;
