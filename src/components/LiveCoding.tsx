import { useEffect, useState } from "react";
import { Terminal, Code2, Cpu, Network, Zap, Brain, Shield, Globe } from "lucide-react";

const LiveCoding = () => {
  const [activeTab, setActiveTab] = useState(0);

  const codeSnippets = [
    {
      title: "AI Model Training",
      icon: Cpu,
      language: "python",
      code: `# Training Neural Network
import tensorflow as tf

model = tf.keras.Sequential([
  tf.keras.layers.Dense(128, activation='relu'),
  tf.keras.layers.Dropout(0.2),
  tf.keras.layers.Dense(10, activation='softmax')
])

model.compile(
  optimizer='adam',
  loss='sparse_categorical_crossentropy',
  metrics=['accuracy']
)

model.fit(x_train, y_train, epochs=10)`,
      color: "secondary"
    },
    {
      title: "Security Scanner",
      icon: Terminal,
      language: "python",
      code: `# Port Scanner Implementation
import socket

def scan_port(target, port):
  sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  sock.settimeout(1)
  result = sock.connect_ex((target, port))
  sock.close()
  return result == 0

target = "192.168.1.1"
open_ports = [p for p in range(1, 1024) 
              if scan_port(target, p)]

print(f"Open ports: {open_ports}")`,
      color: "primary"
    },
    {
      title: "Blockchain Network",
      icon: Network,
      language: "javascript",
      code: `// Blockchain Implementation
class Block {
  constructor(timestamp, data, previousHash = '') {
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return SHA256(
      this.previousHash + 
      this.timestamp + 
      JSON.stringify(this.data)
    ).toString();
  }
}`,
      color: "accent"
    },
    {
      title: "API Integration",
      icon: Code2,
      language: "typescript",
      code: `// AI API Integration
interface AIRequest {
  prompt: string;
  model: string;
}

async function queryAI(req: AIRequest) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  
  return await response.json();
}

const result = await queryAI({
  prompt: "Analyze security threats",
  model: "gpt-4"
});`,
      color: "secondary"
    }
  ];

  const [typedCode, setTypedCode] = useState("");
  const currentSnippet = codeSnippets[activeTab];

  useEffect(() => {
    setTypedCode("");
    let index = 0;
    const code = currentSnippet.code;
    
    const interval = setInterval(() => {
      if (index < code.length) {
        setTypedCode(code.substring(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [activeTab, currentSnippet.code]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % codeSnippets.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [codeSnippets.length]);

  return (
    <section className="py-24 md:py-32 relative overflow-hidden animate-fade-in-up">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background"></div>
      <div className="absolute inset-0 cyber-grid opacity-20"></div>
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-premium"></div>

      {/* Floating Data Streams */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-px bg-gradient-to-b from-transparent via-primary to-transparent animate-data-stream"
            style={{
              left: `${(i + 1) * 12}%`,
              height: "40%",
              animationDelay: `${i * 0.5}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-gradient glow-text animate-fade-in-up">
            Live Code. Real Innovation.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg animate-fade-in-up">
            Watch cutting-edge AI and cybersecurity code come to life.
          </p>
        </div>

        {/* Code Display Section */}
        <div className="max-w-6xl mx-auto">

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-3 mb-6 justify-center">
            {codeSnippets.map((snippet, index) => {
              const Icon = snippet.icon;
              return (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`
                    glass-panel px-6 py-3 rounded-lg transition-all duration-300
                    flex items-center gap-2 group
                    ${activeTab === index 
                      ? `glow-border-premium scale-105` 
                      : 'hover:glow-border hover:scale-105'}
                  `}
                >
                  <Icon className={`w-5 h-5 ${activeTab === index ? 'text-primary' : 'text-muted-foreground'} group-hover:text-primary transition-colors`} />
                  <span className={`font-medium ${activeTab === index ? 'text-foreground' : 'text-muted-foreground'} group-hover:text-foreground transition-colors`}>
                    {snippet.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Terminal Glass Panel */}
          <div className="glass-panel-premium glass-code-terminal rounded-2xl overflow-hidden animate-fade-in-up shadow-2xl">
            {/* Terminal Header */}
            <div className="bg-card/80 px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive animate-pulse"></div>
                  <div className="w-3 h-3 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {currentSnippet.title.toLowerCase().replace(/\s+/g, '_')}.{currentSnippet.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-flicker"></div>
                <span className="text-xs text-primary font-mono">LIVE</span>
              </div>
            </div>

            {/* Code Content */}
            <div className="p-8 bg-card/40 min-h-[400px] relative overflow-hidden">
              {/* Line Numbers */}
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-card/60 border-r border-border/30 flex flex-col p-2 text-right">
                {typedCode.split('\n').map((_, i) => (
                  <span key={i} className="text-xs text-muted-foreground/50 font-mono leading-6">
                    {i + 1}
                  </span>
                ))}
              </div>

              {/* Code Text */}
              <pre className="ml-16 font-mono text-sm leading-6 text-foreground/90">
                <code className="language-python">
                  {typedCode.split('\n').map((line, i) => (
                    <div key={i} className="hover:bg-primary/5 px-2 -mx-2 rounded transition-colors">
                      {line.startsWith('#') || line.startsWith('//') ? (
                        <span className="text-muted-foreground italic">{line}</span>
                      ) : line.includes('import') || line.includes('from') ? (
                        <span className="text-secondary">{line}</span>
                      ) : line.includes('def ') || line.includes('class ') || line.includes('async ') || line.includes('function ') ? (
                        <span className="text-accent font-semibold">{line}</span>
                      ) : line.includes('return') || line.includes('await') ? (
                        <span className="text-primary">{line}</span>
                      ) : (
                        <span>{line}</span>
                      )}
                    </div>
                  ))}
                  <span className="animate-pulse text-primary">█</span>
                </code>
              </pre>

              {/* Glow Effect */}
              <div className={`absolute bottom-0 right-0 w-1/3 h-1/3 bg-${currentSnippet.color} opacity-5 blur-3xl rounded-full`}></div>
            </div>

            {/* Stats Bar */}
            <div className="bg-card/80 px-6 py-3 border-t border-border/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground font-mono">
                  Lines: <span className="text-primary">{typedCode.split('\n').length}</span>
                </span>
                <span className="text-muted-foreground font-mono">
                  Chars: <span className="text-secondary">{typedCode.length}</span>
                </span>
              </div>
              <span className="text-muted-foreground font-mono">
                Language: <span className="text-accent">{currentSnippet.language}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-4 mt-12">
          {[
            { label: "Real-time Execution", icon: Zap, orb: "from-cyan-400 to-blue-500" },
            { label: "AI-Powered Analysis", icon: Brain, orb: "from-fuchsia-500 to-indigo-500" },
            { label: "Security Protocols", icon: Shield, orb: "from-purple-500 to-pink-500" },
            { label: "Cross-Platform", icon: Globe, orb: "from-teal-400 to-cyan-500" } 
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="glass-panel px-6 py-3 rounded-full flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className={`w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br ${feature.orb} shadow-md mr-2`}>
                  <Icon className="w-5 h-5 text-white drop-shadow-cyber" />
                </span>
                <span className="text-sm font-medium text-foreground/90">{feature.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LiveCoding;
