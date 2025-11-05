import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import About from "@/components/About";
import LiveCoding from "@/components/LiveCoding";
import Events from "@/components/Events";
import JoinUs from "@/components/JoinUs";
import Resources from "@/components/Resources";
import Gallery from "@/components/Gallery";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Hero />
      <About />
      <Events />
      <LiveCoding />
      <JoinUs />
      <Resources />
      <Gallery />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
