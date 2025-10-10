import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Activity, Mic, FileText, Clock, Shield, Zap } from "lucide-react";

const Welcome = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Mic,
      title: "AI-Powered Transcription",
      description: "Real-time clinical documentation with advanced speech recognition"
    },
    {
      icon: FileText,
      title: "Structured Notes",
      description: "Generate SOAP notes, H&P, and custom templates automatically"
    },
    {
      icon: Clock,
      title: "Save Time",
      description: "Reduce documentation time by 70% and focus on patient care"
    },
    {
      icon: Shield,
      title: "HIPAA Compliant",
      description: "Enterprise-grade security for sensitive medical data"
    },
    {
      icon: Zap,
      title: "Instant Insights",
      description: "Extract tasks, suggest ICD-10 codes, and identify key information"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Xorstack Health</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/login")}>
            Login
          </Button>
          <Button onClick={() => navigate("/signup")}>
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-8 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            AI-Powered Clinical
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              Documentation Platform
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform clinical encounters into comprehensive medical notes in seconds. 
            Let AI handle documentation while you focus on patient care.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="text-lg px-8">
              Watch Demo
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-success" />
              <span>70% Time Saved</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-success" />
              <span>Real-time AI</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need for efficient clinical documentation
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-8 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6 p-12 rounded-2xl bg-primary text-primary-foreground">
          <h2 className="text-4xl font-bold">
            Ready to transform your clinical workflow?
          </h2>
          <p className="text-lg opacity-90">
            Join thousands of clinicians who've reclaimed their time with AI-powered documentation.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            onClick={() => navigate("/signup")}
            className="text-lg px-8"
          >
            Start Your Free Trial
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Welcome;
