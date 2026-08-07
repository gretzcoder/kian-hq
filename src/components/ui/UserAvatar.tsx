'use client';

import React, { useState, useEffect } from 'react';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  square?: boolean;
  alt?: string;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-xs font-bold',
  lg: 'w-10 h-10 text-sm font-black',
  xl: 'w-12 h-12 text-base font-black',
  '2xl': 'w-16 h-16 text-xl font-black',
  '3xl': 'w-20 h-20 sm:w-28 sm:h-28 text-2xl sm:text-3xl font-black',
};

export function UserAvatar({
  src,
  name,
  size = 'md',
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  square = false,
  alt,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state whenever src changes
  useEffect(() => {
    setImageError(false);
  }, [src]);

  const cleanName = (name || 'User').trim();
  const initials = cleanName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  const shapeClass = square ? 'rounded-2xl' : 'rounded-full';
  const presetSizeClass = typeof size === 'string' && sizeClasses[size] ? sizeClasses[size] : '';
  const customSizeClass = !presetSizeClass && typeof size === 'string' ? size : '';

  const hasValidSrc = Boolean(src && typeof src === 'string' && src.trim().length > 0);

  if (hasValidSrc && !imageError) {
    return (
      <div
        className={`relative overflow-hidden shrink-0 border border-purple-500/30 ${shapeClass} ${presetSizeClass} ${customSizeClass} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src!}
          alt={alt || cleanName}
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
          className={`w-full h-full object-cover ${imageClassName}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black uppercase shadow-xs select-none ${shapeClass} ${presetSizeClass} ${customSizeClass} ${fallbackClassName} ${className}`}
      title={cleanName}
    >
      {initials}
    </div>
  );
}

export default UserAvatar;
