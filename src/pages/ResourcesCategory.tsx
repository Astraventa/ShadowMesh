import { Link, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const CATEGORY_COPY: Record<string, { title: string; description: string } > = {
  "security-tools": {
    title: "Security Tools",
    description: "Top OSS tooling for pentesting, reconnaissance, and security validation curated by ShadowMesh.",
  },
  roadmaps: {
    title: "Roadmaps",
    description: "Structured learning paths for beginners to advanced practitioners with milestones and resources.",
  },
  frameworks: {
    title: "Frameworks",
    description: "OWASP, MITRE ATT&CK, NIST CSF, and other operational frameworks with practical guidance.",
  },
  databases: {
    title: "Databases",
    description: "Vulnerability databases, exploit references, and intel sources tailored for research workflows.",
  },
  "ai-datasets": {
    title: "AI Datasets",
    description: "Curated datasets for ML, security telemetry, and benchmarking.",
  },
  "ai-models": {
    title: "AI Models",
    description: "Starter, finetuning, and deployment-friendly models.",
  },
  "ai-frameworks": {
    title: "AI Frameworks",
    description: "PyTorch, TensorFlow, JAX and tooling with quickstarts.",
  },
  "ai-papers": {
    title: "AI Papers",
    description: "High-signal applied research reading list.",
  },
  "fusion-threat-detection": {
    title: "Fusion: Threat Detection",
    description: "Anomaly detection, IDS, and ML-driven detections.",
  },
  "fusion-sim-playbooks": {
    title: "Fusion: Sim Playbooks",
    description: "Attack/defense simulations and exercises.",
  },
  "fusion-dashboards": {
    title: "Fusion: Dashboards",
    description: "Security analytics dashboards and templates.",
  },
  "fusion-sdks": {
    title: "Fusion: SDKs",
    description: "Integration SDKs and APIs for AI × Security.",
  },
};

type LinkItem = { title: string; description: string; url: string; tag?: string };

const LinkCard = ({ item }: { item: LinkItem }) => (
  <div className="rounded-xl p-5 border border-border/50 bg-card/70 hover:bg-card/80 transition-colors">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="font-semibold mb-1">{item.title}</h4>
        <p className="text-sm text-muted-foreground">{item.description}</p>
      </div>
      {item.tag && (
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">{item.tag}</span>
      )}
    </div>
    <div className="mt-3">
      <Button asChild variant="outline" size="sm">
        <a href={item.url} target="_blank" rel="noreferrer">Open</a>
      </Button>
    </div>
  </div>
);

const Section = ({ title, items }: { title: string; items: LinkItem[] }) => (
  <section>
    <h3 className="text-lg font-semibold mb-3">{title}</h3>
    <div className="grid md:grid-cols-2 gap-4">
      {items.map((i) => (
        <LinkCard key={i.title} item={i} />
      ))}
    </div>
  </section>
);

const CategoryBody = ({ category }: { category: string }) => {
  switch (category) {
    case "security-tools":
      return (
        <div className="space-y-8">
          <Section
            title="Recon & Enumeration"
            items={[
              { title: "amass", description: "In-depth attack surface mapping and asset discovery.", url: "https://github.com/owasp-amass/amass", tag: "OSS" },
              { title: "subfinder", description: "Fast passive subdomain enumeration.", url: "https://github.com/projectdiscovery/subfinder", tag: "OSS" },
              { title: "httpx", description: "HTTP toolkit for probing and fingerprinting.", url: "https://github.com/projectdiscovery/httpx", tag: "OSS" },
              { title: "nuclei", description: "Vulnerabilities scanner using templated checks.", url: "https://github.com/projectdiscovery/nuclei", tag: "OSS" },
            ]}
          />
          <Section
            title="Web & API Testing"
            items={[
              { title: "OWASP ZAP", description: "Interception proxy and active scanner.", url: "https://www.zaproxy.org/", tag: "OWASP" },
              { title: "Burp Suite Community", description: "Proxy, repeater, basic testing toolkit.", url: "https://portswigger.net/burp/communitydownload" },
              { title: "k6", description: "API load testing to validate performance and resiliency.", url: "https://k6.io/" },
              { title: "Postman", description: "API exploration and test runner.", url: "https://www.postman.com/" },
            ]}
          />
          <Section
            title="Cloud & IaC"
            items={[
              { title: "tfsec", description: "Static analysis for Terraform.", url: "https://github.com/aquasecurity/tfsec" },
              { title: "Checkov", description: "Policy-as-code for IaC security.", url: "https://www.checkov.io/" },
              { title: "Trivy", description: "Container and dependency scanning.", url: "https://github.com/aquasecurity/trivy" },
              { title: "Prowler", description: "Multi-cloud security auditing.", url: "https://github.com/prowler-cloud/prowler" },
            ]}
          />
          <Section
            title="Forensics & Blue Team"
            items={[
              { title: "Velociraptor", description: "Endpoint visibility and DFIR toolkit.", url: "https://github.com/Velocidex/velociraptor" },
              { title: "Sigma Rules", description: "Generic signature format for SIEM.", url: "https://github.com/SigmaHQ/sigma" },
              { title: "osquery", description: "SQL-powered endpoint telemetry.", url: "https://github.com/osquery/osquery" },
            ]}
          />
        </div>
      );
    case "roadmaps":
      return (
        <div className="space-y-8">
          <Section
            title="Foundation"
            items={[
              { title: "Linux Journey", description: "Interactive lessons to build Linux fundamentals.", url: "https://linuxjourney.com/" },
              { title: "Computer Networking", description: "Stanford CS144/Georgia Tech OMSCS resources.", url: "https://github.com/omscs-notes/CS-6250-Computer-Networking" },
              { title: "OWASP Top 10", description: "Modern web risks every builder and tester must know.", url: "https://owasp.org/www-project-top-ten/" },
              { title: "Crypto 101", description: "A book about cryptography for developers.", url: "https://crypto101.io/" },
            ]}
          />
          <Section
            title="Pentest Track"
            items={[
              { title: "TryHackMe", description: "Guided labs from beginner to advanced.", url: "https://tryhackme.com/" },
              { title: "Hack The Box Academy", description: "Hands-on modules and labs.", url: "https://academy.hackthebox.com/" },
              { title: "PortSwigger Web Academy", description: "Deep web security learning path.", url: "https://portswigger.net/web-security" },
              { title: "Reporting Guide", description: "Structure and write professional pentest reports.", url: "https://github.com/juliocesarfort/public-pentesting-reports" },
            ]}
          />
        </div>
      );
    case "frameworks":
      return (
        <div className="space-y-8">
          <Section
            title="OWASP"
            items={[
              { title: "Testing Guide", description: "End-to-end web app testing methodology.", url: "https://owasp.org/www-project-web-security-testing-guide/" },
              { title: "ASVS", description: "Application security verification standard.", url: "https://owasp.org/www-project-application-security-verification-standard/" },
              { title: "Cheat Sheet Series", description: "Practical how-tos for builders and testers.", url: "https://cheatsheetseries.owasp.org/" },
            ]}
          />
          <Section
            title="MITRE & NIST"
            items={[
              { title: "ATT&CK", description: "Tactics, techniques, and procedures knowledge base.", url: "https://attack.mitre.org/" },
              { title: "D3FEND", description: "Countermeasures mapped to ATT&CK techniques.", url: "https://d3fend.mitre.org/" },
              { title: "NIST CSF 2.0", description: "Cybersecurity framework core and profiles.", url: "https://www.nist.gov/cyberframework" },
            ]}
          />
        </div>
      );
    case "databases":
      return (
        <div className="space-y-8">
          <Section
            title="Vulnerability Databases"
            items={[
              { title: "NVD", description: "National Vulnerability Database with CVSS scoring.", url: "https://nvd.nist.gov/" },
              { title: "CVE.org", description: "Official source for CVE identifiers and records.", url: "https://www.cve.org/" },
              { title: "Exploit Database", description: "Public exploits and proof-of-concepts.", url: "https://www.exploit-db.com/" },
              { title: "OSV", description: "Open source vulnerabilities across ecosystems.", url: "https://osv.dev/" },
            ]}
          />
          <Section
            title="Advisories & Intel"
            items={[
              { title: "CISA KEV", description: "Known exploited vulnerabilities catalog.", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog" },
              { title: "CERT/CC", description: "Vulnerability notes and advisories.", url: "https://www.kb.cert.org/vuls/" },
              { title: "GitHub Advisories", description: "Security advisories for packages.", url: "https://github.com/advisories" },
            ]}
          />
        </div>
      );
    case "ai-datasets":
      return (
        <div className="space-y-8">
          <Section
            title="Security Telemetry"
            items={[
              { title: "CIDDS-001", description: "Labeled network traffic for IDS research.", url: "https://www.hs-coburg.de/forschung/forschungsprojekte/cidds.html" },
              { title: "UNSW-NB15", description: "Modern network intrusion dataset.", url: "https://www.unsw.adfa.edu.au/unsw-canberra-cyber/cybersecurity/ADFA-NB15-Datasets/" },
              { title: "Zeek Logs Samples", description: "Public PCAP-to-Zeek examples.", url: "https://docs.zeek.org/en/current/learning/examples.html" },
            ]}
          />
          <Section
            title="General ML"
            items={[
              { title: "Hugging Face Datasets", description: "Community datasets with streaming.", url: "https://huggingface.co/datasets" },
              { title: "ImageNet Subsets", description: "Small, permissive subsets like ImageNette.", url: "https://github.com/fastai/imagenette" },
            ]}
          />
        </div>
      );
    case "ai-models":
      return (
        <div className="space-y-8">
          <Section
            title="Baselines"
            items={[
              { title: "scikit-learn", description: "Tried-and-true models for tabular baselines.", url: "https://scikit-learn.org/" },
              { title: "Isolation Forest", description: "Anomaly detection for logs and metrics.", url: "https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html" },
              { title: "XGBoost", description: "Gradient boosting for strong baseline performance.", url: "https://xgboost.readthedocs.io/" },
            ]}
          />
          <Section
            title="Deployment"
            items={[
              { title: "ONNX Runtime", description: "Portable inference across platforms.", url: "https://onnxruntime.ai/" },
              { title: "TensorRT", description: "High-performance inference on NVIDIA GPUs.", url: "https://developer.nvidia.com/tensorrt" },
              { title: "vLLM", description: "Fast LLM serving with PagedAttention.", url: "https://vllm.ai/" },
            ]}
          />
        </div>
      );
    case "ai-frameworks":
      return (
        <div className="space-y-8">
          <Section
            title="Deep Learning"
            items={[
              { title: "PyTorch", description: "Flexible, pythonic framework for DL research.", url: "https://pytorch.org/" },
              { title: "TensorFlow", description: "Production-grade training and serving.", url: "https://www.tensorflow.org/" },
              { title: "JAX", description: "High-performance autodiff and accelerators.", url: "https://jax.readthedocs.io/" },
            ]}
          />
          <Section
            title="Experiment Tracking"
            items={[
              { title: "Weights & Biases", description: "Experiment tracking and model registry.", url: "https://wandb.ai/" },
              { title: "MLflow", description: "Open-source MLOps platform.", url: "https://mlflow.org/" },
            ]}
          />
        </div>
      );
    case "ai-papers":
      return (
        <div className="space-y-8">
          <Section
            title="Applied ML in Security"
            items={[
              { title: "ML for Intrusion Detection (Survey)", description: "Overview of ML techniques for IDS.", url: "https://arxiv.org/abs/1807.02811" },
              { title: "Adversarial Examples (Survey)", description: "Attacks and defenses in adversarial ML.", url: "https://arxiv.org/abs/1810.00069" },
            ]}
          />
          <Section
            title="Best Practices"
            items={[
              { title: "Hidden Technical Debt in ML", description: "Classic pitfalls in ML systems.", url: "https://papers.nips.cc/paper_files/paper/2015/file/86df7dcfd896fcaf2674f757a2463eba-Paper.pdf" },
            ]}
          />
        </div>
      );
    case "fusion-threat-detection":
      return (
        <div className="space-y-8">
          <Section
            title="Detection Techniques"
            items={[
              { title: "Twitter Anomaly (ADVec)", description: "Time series anomaly detection overview.", url: "https://arxiv.org/abs/1802.04431" },
              { title: "Sketching for Security", description: "Approximate data structures for streaming detection.", url: "https://queue.acm.org/detail.cfm?id=3241976" },
            ]}
          />
          <Section
            title="IDS"
            items={[
              { title: "Suricata", description: "Open IDS/IPS engine with rule ecosystem.", url: "https://suricata.io/" },
              { title: "Zeek", description: "Network security monitor and platform.", url: "https://zeek.org/" },
            ]}
          />
        </div>
      );
    case "fusion-sim-playbooks":
      return (
        <div className="space-y-8">
          <Section
            title="Exercises"
            items={[
              { title: "Atomic Red Team", description: "Small, portable tests mapped to ATT&CK.", url: "https://atomicredteam.io/" },
              { title: "PurpleSharp", description: "Adversary simulation for Windows environments.", url: "https://github.com/mvelazc0/PurpleSharp" },
            ]}
          />
        </div>
      );
    case "fusion-dashboards":
      return (
        <div className="space-y-8">
          <Section
            title="Dashboards"
            items={[
              { title: "Sigma → SIEM", description: "Rules to visualize detections across SIEMs.", url: "https://github.com/SigmaHQ/sigma" },
              { title: "Grafana Security Boards", description: "Build log/metric dashboards for SOCs.", url: "https://grafana.com/" },
            ]}
          />
        </div>
      );
    case "fusion-sdks":
      return (
        <div className="space-y-8">
          <Section
            title="SDKs & Integrations"
            items={[
              { title: "OpenAI SDK", description: "JS/TS and Python client libraries.", url: "https://platform.openai.com/docs/libraries" },
              { title: "LangChain", description: "Framework for LLM apps and agents.", url: "https://python.langchain.com/" },
              { title: "Vector DBs", description: "FAISS, Milvus, and pgvector resources.", url: "https://github.com/facebookresearch/faiss" },
            ]}
          />
        </div>
      );
    default:
      return (
        <div className="glass-panel p-6 rounded-xl">
          <p className="text-sm text-muted-foreground">Category not found.</p>
        </div>
      );
  }
};

const ResourcesCategory = () => {
  const { category = "" } = useParams();
  const meta = CATEGORY_COPY[category ?? ""];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="container mx-auto px-4 pt-28 pb-16">
        <div className="mb-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to Home</Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">{meta?.title ?? "Resources"}</h1>
        <p className="text-muted-foreground mb-8">{meta?.description ?? "Explore curated resources."}</p>
        <CategoryBody category={category ?? ""} />
      </main>
      <Footer />
    </div>
  );
};

export default ResourcesCategory;


