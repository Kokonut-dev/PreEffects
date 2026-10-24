import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

export const IconCursor: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round">
    <path d="M3.5 2L12.5 8.2L8.2 9.1L10.3 13.5L8.4 14.3L6.3 9.9L3.5 12.6V2Z" />
  </svg>
);

export const IconHand: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round">
    <path d="M6 8V3.2a1 1 0 0 1 2 0V7M8 7V2.5a1 1 0 0 1 2 0V7M10 7V3.5a1 1 0 0 1 2 0v6c0 2.5-1.8 4.2-4.2 4.2H6.8c-1.8 0-3.3-1.2-3.8-2.9L2.2 8.5a1 1 0 0 1 1.7-.9L5 9V4.8a1 1 0 0 1 1-1" />
  </svg>
);

export const IconZoom: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

export const IconRotate: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.8h-2.8" />
  </svg>
);

export const IconCamera: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round">
    <rect x="1.5" y="4.5" width="9" height="7" rx="1.2" />
    <path d="M10.5 6.8L14.5 4.8V11.2L10.5 9.2Z" />
  </svg>
);

export const IconAnchor: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
  </svg>
);

export const IconShapeRect: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
  </svg>
);

export const IconPen: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 2L13 10.5L9.8 13.5H6.2L3 10.5L8 2Z" />
    <circle cx="8" cy="8.5" r="1" fill={color} />
  </svg>
);

export const IconText: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <path d="M3 3.5H13M8 3.5V13M5.8 13H10.2" />
  </svg>
);

export const IconBrush: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round">
    <path d="M10.8 2.2L13.8 5.2L7.5 11.5L4.5 8.5L10.8 2.2Z" />
    <path d="M4.5 8.5C3.2 9.2 2.5 10.8 2.2 13.5C4.8 13.3 6.5 12.6 7.5 11.5" />
  </svg>
);

export const IconClone: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M6 3.5a2 2 0 1 1 4 0c0 1.4-1 2.2-1 3.5H7c0-1.3-1-2.1-1-3.5Z" />
    <rect x="3" y="9" width="10" height="3" rx="1" />
    <path d="M4 13.5H12" />
  </svg>
);

export const IconRoto: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="6" r="3" />
    <path d="M3.5 13.5c.8-2.4 2.5-3.8 4.5-3.8s3.7 1.4 4.5 3.8" />
    <path d="M12.5 2.5L14 4M14 2.5L12.5 4" />
  </svg>
);

export const IconPin: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5.5" r="2.8" />
    <path d="M8 8.3V14" />
  </svg>
);

export const IconPlay: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <path d="M4.5 2.8L13.2 8L4.5 13.2V2.8Z" />
  </svg>
);

export const IconPause: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <rect x="4" y="3" width="3" height="10" rx="0.8" />
    <rect x="9" y="3" width="3" height="10" rx="0.8" />
  </svg>
);

export const IconEye: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5">
    <path d="M1.5 8C3.2 4.8 5.5 3.5 8 3.5S12.8 4.8 14.5 8C12.8 11.2 10.5 12.5 8 12.5S3.2 11.2 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

export const IconCube3D: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round">
    <path d="M8 1.8L13.8 5V11L8 14.2L2.2 11V5L8 1.8Z" />
    <path d="M2.2 5L8 8.2L13.8 5M8 8.2V14.2" />
  </svg>
);

export const IconDiamond: React.FC<{ active?: boolean; size?: number }> = ({ active = false, size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill={active ? '#E89B3C' : 'none'} stroke={active ? '#E89B3C' : 'currentColor'} strokeWidth="1.4">
    <path d="M7 1.5L12.5 7L7 12.5L1.5 7L7 1.5Z" />
  </svg>
);

export const IconSun: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
  </svg>
);

export const IconMoon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round">
    <path d="M13.2 10.2A5.5 5.5 0 0 1 5.8 2.8a5.6 5.6 0 1 0 7.4 7.4Z" />
  </svg>
);
