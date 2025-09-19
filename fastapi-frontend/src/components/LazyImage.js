import React, { useState, useRef, useEffect } from 'react';

const LazyImage = ({ src, alt, className, placeholder, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div ref={imgRef} className={`lazy-image-container ${className || ''}`}>
      {!isLoaded && (
        <div className="lazy-image-placeholder">
          {placeholder || <div className="animate-pulse bg-gray-200 h-full w-full rounded"></div>}
        </div>
      )}

      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`lazy-image ${isLoaded ? 'loaded' : 'loading'} ${hasError ? 'error' : ''}`}
          {...props}
        />
      )}

      <style jsx>{`
        .lazy-image-container {
          position: relative;
          overflow: hidden;
        }

        .lazy-image-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lazy-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: opacity 0.3s ease-in-out;
          opacity: 0;
        }

        .lazy-image.loaded {
          opacity: 1;
        }

        .lazy-image.error {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
};

export default LazyImage;