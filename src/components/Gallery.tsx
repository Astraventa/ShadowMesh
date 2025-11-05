import { useState } from "react";

const Gallery = () => {
  // Launch state: no images yet. Add URLs later to enable mosaic.
  const images: { id: number; url: string; alt: string; span?: string; shape?: string }[] = [];

  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const hasImages = images.length > 0;

  return (
    <section id="gallery" className="py-24 md:py-32 relative">
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

        {hasImages ? (
          <>
            {/* Mosaic Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[160px] md:auto-rows-[200px] gap-4">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className={`relative group cursor-pointer overflow-hidden ${image.shape || 'rounded-2xl'} ${image.span || ''} animate-fade-in-up`}
                  style={{ animationDelay: `${index * 0.08}s` }}
                  onClick={() => setSelectedImage(image.id)}
                >
                  <img src={image.url} alt={image.alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <p className="text-[13px] font-medium text-foreground/90">{image.alt}</p>
                  </div>
                  <div className="absolute inset-0 border-2 border-primary/0 group-hover:border-primary/40 rounded-2xl transition-all duration-300"></div>
                </div>
              ))}
            </div>
          </>
        ) : (
          // Empty state
          <div className="glass-panel-premium rounded-2xl max-w-4xl mx-auto p-12 text-center animate-fade-in-up">
            <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/30 flex items-center justify-center shadow-cyber-glow">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
                <path d="M3 5h18M3 12h12M3 19h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-2">Gallery Coming Soon</h3>
            <p className="text-muted-foreground mb-8">We’re just launching. Follow us to catch photos and highlights as they drop.</p>
            <div className="flex flex-wrap justify-center gap-4">
              {/* Instagram */}
              <a href="https://instagram.com/shadowmesh.riuf" target="_blank" rel="noopener noreferrer" className="px-4 py-3 rounded-lg hover:opacity-95 transition-all duration-300 font-medium inline-flex items-center gap-2 badge-ig">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor"/><path d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" stroke="currentColor"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
                Instagram
              </a>
              {/* YouTube */}
              <a href="https://youtube.com/@shadowmesh" target="_blank" rel="noopener noreferrer" className="px-4 py-3 rounded-lg hover:opacity-95 transition-all duration-300 font-medium inline-flex items-center gap-2 badge-yt">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M23 7.5s-.2-1.6-.8-2.3c-.7-.8-1.5-.8-1.9-.9C17.6 3.9 12 3.9 12 3.9s-5.6 0-8.3.4c-.4.1-1.2.1-1.9.9C.2 5.9 0 7.5 0 7.5S0 9.4 0 11.3v1.4c0 1.9.2 3.8.2 3.8s.2 1.6.8 2.3c.7.8 1.7.8 2.1.9 1.5.1 7 .4 8.9.4 0 0 5.6 0 8.3-.4.4-.1 1.2-.1 1.9-.9.6-.7.8-2.3.8-2.3s.2-1.9.2-3.8v-1.4c0-1.9-.2-3.8-.2-3.8Z"/>
                  <path d="M9.75 9.5v5l5-2.5-5-2.5Z" fill="#fff"/>
                </svg>
                YouTube
              </a>
              {/* LinkedIn */}
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="px-4 py-3 rounded-lg hover:opacity-95 transition-all duration-300 font-medium inline-flex items-center gap-2 badge-li">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0ZM.5 8.5h4.9V24H.5V8.5Zm7.8 0h4.7v2.1h.1c.6-1.1 2.1-2.3 4.3-2.3 4.6 0 5.4 3 5.4 6.9V24h-4.9v-6.8c0-1.6 0-3.6-2.2-3.6s-2.5 1.7-2.5 3.5V24H8.3V8.5Z"/></svg>
                LinkedIn
              </a>
              {/* TikTok */}
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="px-4 py-3 rounded-lg hover:opacity-95 transition-all duration-300 font-medium inline-flex items-center gap-2 badge-tt">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 8.5a7 7 0 0 1-5-2.1V17a7 7 0 1 1-7-7c.3 0 .7 0 1 .1V13a3 3 0 1 0 3 3V0h3c.2 1.8 1.4 3.3 3 4 1 .5 2 .7 3 .7v3.8Z"/></svg>
                TikTok
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {hasImages && selectedImage && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={() => setSelectedImage(null)}>
          <img src={images.find(img => img.id === selectedImage)?.url as string} alt={images.find(img => img.id === selectedImage)?.alt as string} className="max-w-full max-h-full rounded-lg glow-border" />
        </div>
      )}
    </section>
  );
};

export default Gallery;
