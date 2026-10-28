import React from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  /** Above-the-fold images should load eagerly. */
  eager?: boolean;
  style?: React.CSSProperties;
}

/**
 * Plain <img> wrapper.
 *
 * React Native Web's <Image> renders a <div> with a background-image, which
 * the browser cannot lazy-load. A real <img> enables native lazy loading and
 * async decoding, so offscreen cards don't compete with the first paint.
 */
export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, eager = false, style }) => (
  <img
    src={src}
    alt={alt}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    style={{
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      ...style,
    }}
  />
);
