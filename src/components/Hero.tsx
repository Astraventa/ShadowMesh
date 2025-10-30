import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

const Hero = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  const rotateX = useTransform(mouseY, [0, window.innerHeight], [10, -10]);
  const rotateY = useTransform(mouseX, [0, window.innerWidth], [-10, 10]);

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background Layers */}
      <div className="absolute inset-0 bg-background">
        {/* Cyber Grid with Pulse */}
        <div className="absolute inset-0 cyber-grid opacity-20 animate-pulse-glow"></div>
        
        {/* Energy Flow Lines */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`flow-${i}`}
              className="absolute h-px bg-gradient-to-r from-transparent via-primary to-transparent"
              style={{
                width: '200%',
                top: `${(i + 1) * 12}%`,
                left: '-100%',
              }}
              animate={{
                x: ['0%', '100%'],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "linear",
              }}
            />
          ))}
        </div>

        {/* Particle System */}
        <div className="absolute inset-0">
          {[...Array(40)].map((_, i) => {
            const size = Math.random() * 3 + 1;
            const color = i % 3 === 0 ? 'bg-primary' : i % 3 === 1 ? 'bg-secondary' : 'bg-accent';
            return (
              <motion.div
                key={`particle-${i}`}
                className={`absolute rounded-full ${color}`}
                style={{
                  width: size,
                  height: size,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.2, 0.8, 0.2],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: 4 + Math.random() * 4,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </div>

        {/* 3D Holographic Sphere */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            rotateX: mounted ? rotateX : 0,
            rotateY: mounted ? rotateY : 0,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="relative w-[500px] h-[500px]">
            {/* Rotating Rings */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute inset-0 rounded-full border-2 opacity-30"
                style={{
                  borderColor: i === 0 ? 'hsl(var(--primary))' : i === 1 ? 'hsl(var(--secondary))' : 'hsl(var(--accent))',
                  transform: `rotateX(${i * 60}deg)`,
                }}
                animate={{
                  rotateZ: 360,
                }}
                transition={{
                  duration: 20 - i * 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
            
            {/* Pulse Waves */}
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/50"
              animate={{
                scale: [1, 2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6"
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <span className="text-gradient glow-text">Where Hackers and Innovators</span>
          <br />
          <motion.span
            className="text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Mesh Minds.
          </motion.span>
        </motion.h1>
        
        <motion.p
          className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          A fusion of <span className="text-primary font-semibold">Cybersecurity</span>, <span className="text-secondary font-semibold">Artificial Intelligence</span>, and <span className="text-accent font-semibold">Human Ingenuity</span>.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button size="lg" variant="cyber" asChild>
              <a href="#join">Join the Network</a>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button size="lg" variant="glow" asChild>
              <a href="#events">Explore Events</a>
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{
            opacity: { delay: 1.8, duration: 0.5 },
            y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <a href="#about" className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors group">
            <span className="text-sm mb-2">Scroll to explore</span>
            <div className="relative">
              <ChevronDown className="w-6 h-6" />
              <motion.div
                className="absolute inset-0 w-6 h-6"
                animate={{
                  opacity: [0, 0.5, 0],
                  scale: [1, 1.5, 2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              >
                <ChevronDown className="w-6 h-6 text-primary" />
              </motion.div>
            </div>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
