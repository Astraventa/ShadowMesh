import { Mail, Instagram, Linkedin, Github, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const Contact = () => {
  const socialLinks = [
    { icon: Instagram, label: "Instagram", href: "https://instagram.com/shadowmesh.riuf", color: "hover:text-[#E4405F]" },
    { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com/company/shadowmesh", color: "hover:text-[#0A66C2]" },
    { icon: Github, label: "GitHub", href: "https://github.com/shadowmesh", color: "hover:text-foreground" },
    { icon: Youtube, label: "YouTube", href: "https://youtube.com/@shadowmesh", color: "hover:text-[#FF0000]" },
  ];

  return (
    <section id="contact" className="py-20 md:py-32 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">Get in Touch</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Have questions? Want to collaborate? We'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="glass-panel p-8 rounded-2xl">
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input 
                    placeholder="Your name" 
                    className="bg-background/50 border-border focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input 
                    type="email" 
                    placeholder="your.email@example.com" 
                    className="bg-background/50 border-border focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <Textarea 
                    placeholder="Tell us what's on your mind..." 
                    rows={5}
                    className="bg-background/50 border-border focus:border-primary transition-colors resize-none"
                  />
                </div>

                <Button type="submit" size="lg" variant="cyber" className="w-full">
                  Send Message
                </Button>
              </form>
            </div>

            {/* Contact Info & Socials */}
            <div className="space-y-8">
              {/* Email */}
              <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/20">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email Us</h3>
                    <a 
                      href="mailto:shadowmesh.community@gmail.com" 
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      shadowmesh.community@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="font-semibold mb-4">Connect With Us</h3>
                <div className="grid grid-cols-2 gap-4">
                  {socialLinks.map((social) => {
                    const Icon = social.icon;
                    return (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-card/50 transition-all duration-300 group ${social.color}`}
                      >
                        <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="text-sm font-medium">{social.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Community Info */}
              <div className="glass-panel p-6 rounded-xl glow-border">
                <h3 className="font-semibold mb-2">Join the Community</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Be part of Pakistan's fastest-growing cyber and AI innovation network.
                </p>
                <Button variant="glow" className="w-full" asChild>
                  <a href="#join">Become a Member</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
