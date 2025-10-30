import { useState } from "react";

const Gallery = () => {
  // Placeholder images - in production, these would be actual event photos
  const images = [
    { id: 1, url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=600&fit=crop", alt: "Hackathon event" },
    { id: 2, url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop", alt: "Workshop session" },
    { id: 3, url: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop", alt: "Team collaboration" },
    { id: 4, url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop", alt: "Coding workshop" },
    { id: 5, url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=600&fit=crop", alt: "Project presentation" },
    { id: 6, url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop", alt: "Community meetup" },
  ];

  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  return (
    <section id="gallery" className="py-20 md:py-32 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Gallery</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Moments from our events, workshops, and community gatherings.
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative group cursor-pointer overflow-hidden rounded-lg aspect-video animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => setSelectedImage(image.id)}
            >
              <img
                src={image.url}
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <p className="text-sm font-medium text-foreground">{image.alt}</p>
              </div>

              {/* Glow Border Effect */}
              <div className="absolute inset-0 border-2 border-primary/0 group-hover:border-primary/50 rounded-lg transition-all duration-300"></div>
            </div>
          ))}
        </div>

        {/* Social Media Section */}
        <div className="mt-16 text-center">
          <div className="glass-panel p-8 rounded-2xl max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">
              Follow Our <span className="text-gradient">Journey</span>
            </h3>
            <p className="text-muted-foreground mb-6">
              Stay updated with our latest events, workshops, and community highlights on social media.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://instagram.com/shadowmesh.riuf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 glass-panel rounded-lg hover:glow-border transition-all duration-300 font-medium"
              >
                Instagram
              </a>
              <a
                href="https://youtube.com/@shadowmesh"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 glass-panel rounded-lg hover:glow-border transition-all duration-300 font-medium"
              >
                YouTube
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4 animate-fade-in-up"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={images.find(img => img.id === selectedImage)?.url}
            alt={images.find(img => img.id === selectedImage)?.alt}
            className="max-w-full max-h-full rounded-lg glow-border"
          />
        </div>
      )}
    </section>
  );
};

export default Gallery;
