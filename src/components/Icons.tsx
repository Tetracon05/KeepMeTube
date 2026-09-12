import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 16,
  className = "",
  children,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const IconPlus: React.FC<IconProps> = (p) => (
  <Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>
);

export const IconPause: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></Icon>
);

export const IconPlay: React.FC<IconProps> = (p) => (
  <Icon {...p}><polygon points="5 3 19 12 5 21 5 3"/></Icon>
);

export const IconFolderOpen: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M2 19V9a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/></Icon>
);

export const IconEdit: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></Icon>
);

export const IconX: React.FC<IconProps> = (p) => (
  <Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>
);

export const IconTrash: React.FC<IconProps> = (p) => (
  <Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></Icon>
);

export const IconDownload: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>
);

export const IconVideo: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></Icon>
);

export const IconMusic: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Icon>
);

export const IconMonitor: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></Icon>
);

export const IconSettings: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>
);

export const IconSun: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Icon>
);

export const IconMoon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>
);

export const IconAlertTriangle: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Icon>
);

export const IconCheckCircle: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></Icon>
);

export const IconXCircle: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></Icon>
);

export const IconClock: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>
);

export const IconUser: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>
);

export const IconList: React.FC<IconProps> = (p) => (
  <Icon {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Icon>
);

export const IconCheckSquare: React.FC<IconProps> = (p) => (
  <Icon {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Icon>
);

export const IconSquare: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></Icon>
);

export const IconFile: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Icon>
);

export const IconCalendar: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>
);

export const IconHardDrive: React.FC<IconProps> = (p) => (
  <Icon {...p}><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></Icon>
);

export const IconChevronUp: React.FC<IconProps> = (p) => (
  <Icon {...p}><polyline points="18 15 12 9 6 15"/></Icon>
);

export const IconChevronDown: React.FC<IconProps> = (p) => (
  <Icon {...p}><polyline points="6 9 12 15 18 9"/></Icon>
);

export const IconChevronLeft: React.FC<IconProps> = (p) => (
  <Icon {...p}><polyline points="15 18 9 12 15 6"/></Icon>
);

export const IconShield: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>
);

export const IconPalette: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3a2 2 0 0 1 2-2h2a3 3 0 0 0 3-3 10 10 0 0 0-8-10z"/><circle cx="7" cy="10" r="1"/><circle cx="10.5" cy="6.5" r="1"/><circle cx="14.5" cy="6.5" r="1"/><circle cx="17.5" cy="10" r="1"/></Icon>
);

export const IconGlobe: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Icon>
);

export const IconRefreshCw: React.FC<IconProps> = (p) => (
  <Icon {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Icon>
);

export const IconSearch: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>
);

export const IconInfo: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></Icon>
);

export const IconZap: React.FC<IconProps> = (p) => (
  <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>
);

/**
 * The KeepMeTube mark — a double chevron. Reads as both "rewind" and "pull
 * down": a generic download motion rather than a play button, so it stays
 * neutral across 1800+ source sites instead of evoking any one platform.
 * Doesn't use the shared `Icon` wrapper — its stroke weight/caps/joins are
 * a fixed brand spec (see rewind-media-downloader-logo/), not the generic
 * UI icon-set style.
 */
export const IconLogo: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    className={className}
  >
    <path d="M8 14 L24 28 L40 14" stroke="currentColor" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter"/>
    <path d="M8 24 L24 38 L40 24" stroke="currentColor" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter"/>
  </svg>
);
