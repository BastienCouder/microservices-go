"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check, ExternalLink, Terminal } from "lucide-react";

export function DevelopersSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const codeExamples = [
    {
      label: "API REST",
      language: "javascript",
      code: `// Récupérer vos scores de visibilité par LLM
const response = await fetch('https://api.visia.ai/v1/scores', {
  headers: { 'Authorization': \`Bearer \${process.env.VISIA_KEY}\` }
});

const data = await response.json();
console.log('Visibility Score:', data.global_score);`,
    },
    {
      label: "MCP Server",
      language: "json",
      code: `// config.json (Claude Desktop / Cursor)
{
  "mcpServers": {
    "visia": {
      "command": "npx",
      "args": ["@visia/mcp-server"],
      "env": { "VISIA_API_KEY": "YOUR_KEY" }
    }
  }
}`,
    },
    {
      label: "Webhooks",
      language: "javascript",
      code: `// Alerte en temps réel sur changement de réponse
app.post('/webhooks/visia', (req, res) => {
  const { llm, brand, change_detected } = req.body;
  
  if (change_detected) {
    notifyGrowthTeam(\`Alerte : Visibilité impactée sur \${llm}\`);
  }
  res.status(200).send('OK');
});`,
    },
  ];

  const features = [
    { 
      title: "API REST", 
      description: "Accès programmatique à tous vos scores et métriques de visibilité."
    },
    { 
      title: "MCP Server", 
      description: "Connectez VISIA à Claude, Cursor ou votre agent IA interne."
    },
    { 
      title: "Webhooks", 
      description: "Alertes en temps réel sur chaque changement de réponse IA."
    },
    { 
      title: "Export CSV / JSON", 
      description: "Vos données directement dans vos outils de reporting habituels."
    },
    { 
      title: "Docs complètes", 
      description: "Guides et exemples disponibles dès le premier jour."
    },
  ];

  const codeAnimationStyles = `
  .dev-code-line {
    opacity: 0;
    transform: translateX(-8px);
    animation: devLineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devLineReveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .dev-code-char {
    opacity: 0;
    filter: blur(8px);
    animation: devCharReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devCharReveal {
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="developers" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-background">
      <style dangerouslySetInnerHTML={{ __html: codeAnimationStyles }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <h2 className="text-primary text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Conçu pour les équipes.
              <br />
              <span className="text-muted-foreground">Et leurs développeurs.</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl">
              API REST complète, webhooks, serveur MCP, export CSV/JSON. Automatisez vos audits et intégrez VISIA dans vos workflows existants.
            </p>
            
            {/* Features Grid */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <h3 className="font-mono text-sm font-bold text-primary mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right: Terminal / Code block */}
          <div
            className={`lg:sticky lg:top-32 transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10 bg-primary/[0.02] backdrop-blur-sm rounded-lg">
              {/* Header / Tabs */}
              <div className="flex items-center border-b border-primary/10 overflow-x-auto no-scrollbar">
                {codeExamples.map((example, idx) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-6 py-4 text-xs font-mono transition-colors relative whitespace-nowrap ${
                      activeTab === idx
                        ? "text-primary bg-primary/[0.03]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {example.label}
                    {activeTab === idx && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                ))}
                <div className="flex-1 min-w-[20px]" />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-4 text-primary hover:text-foreground transition-colors border-l border-foreground/10"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {/* Code content */}
              <div className="p-6 lg:p-8 font-mono text-sm min-h-[300px] overflow-x-auto bg-background">
                <pre className="text-foreground/80">
                  {codeExamples[activeTab].code.split('\n').map((line, lineIndex) => (
                    <div 
                      key={`${activeTab}-${lineIndex}`} 
                      className="leading-loose dev-code-line"
                      style={{ animationDelay: `${lineIndex * 50}ms` }}
                    >
                      <span className="text-foreground/30 mr-4 select-none inline-block w-4">{lineIndex + 1}</span>
                      <span className="inline-flex">
                        {line.split('').map((char, charIndex) => (
                          <span
                            key={`${activeTab}-${lineIndex}-${charIndex}`}
                            className="dev-code-char"
                            style={{
                              animationDelay: `${lineIndex * 50 + charIndex * 10}ms`,
                            }}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>

              {/* Terminal Footer Status */}
              <div className="px-6 py-3 border-t border-foreground/10 bg-background/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                </div>
                <div className="text-[10px] font-mono text-green-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-green-500" />
                  API en ligne
                </div>
              </div>
            </div>
            
            {/* Action Links */}
            <div className="mt-8 flex items-center gap-8 text-sm font-medium">
              <a href="#" className="inline-flex items-center gap-2 text-foreground hover:underline underline-offset-4 decoration-1">
                Documentation complète
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}