import React, { forwardRef } from 'react';

import { ICON_NODES } from './icons/icon-data';
import type { GenericIconProps, IconProps, LucideIcon } from './icons/types';

export type { GenericIconProps, IconName, IconProps, LucideIcon } from './icons/types';

function renderIcon(
  iconName: string,
  {
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    className = '',
    children,
    ...rest
  }: IconProps,
  ref: React.ForwardedRef<SVGSVGElement>,
): React.ReactElement {
  const kebabName = iconName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

  const elements = ICON_NODES[iconName] || [];

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={
        rest['aria-label'] || rest['aria-labelledby'] ? undefined : (rest['aria-hidden'] ?? 'true')
      }
      className={`lucide lucide-${kebabName} ${className}`.trim()}
      {...rest}
    >
      {elements.map(([tag, attrs], idx) =>
        React.createElement(tag, { key: (attrs.key as string) || idx, ...attrs }),
      )}
      {children}
    </svg>
  );
}

/** Accessibility SVG icon primitive */
export const Accessibility: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Accessibility(props, ref) {
    return renderIcon('Accessibility', props, ref);
  },
);

/** Activity SVG icon primitive */
export const Activity: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Activity(props, ref) {
    return renderIcon('Activity', props, ref);
  },
);

/** AlertTriangle SVG icon primitive */
export const AlertTriangle: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function AlertTriangle(props, ref) {
    return renderIcon('AlertTriangle', props, ref);
  },
);

/** ArrowLeft SVG icon primitive */
export const ArrowLeft: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ArrowLeft(props, ref) {
    return renderIcon('ArrowLeft', props, ref);
  },
);

/** ArrowRight SVG icon primitive */
export const ArrowRight: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ArrowRight(props, ref) {
    return renderIcon('ArrowRight', props, ref);
  },
);

/** ArrowUpDown SVG icon primitive */
export const ArrowUpDown: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ArrowUpDown(props, ref) {
    return renderIcon('ArrowUpDown', props, ref);
  },
);

/** Award SVG icon primitive */
export const Award: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Award(props, ref) {
  return renderIcon('Award', props, ref);
});

/** Ban SVG icon primitive */
export const Ban: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Ban(props, ref) {
  return renderIcon('Ban', props, ref);
});

/** Bike SVG icon primitive */
export const Bike: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Bike(props, ref) {
  return renderIcon('Bike', props, ref);
});

/** Box SVG icon primitive */
export const Box: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Box(props, ref) {
  return renderIcon('Box', props, ref);
});

/** Briefcase SVG icon primitive */
export const Briefcase: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Briefcase(props, ref) {
    return renderIcon('Briefcase', props, ref);
  },
);

/** Bug SVG icon primitive */
export const Bug: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Bug(props, ref) {
  return renderIcon('Bug', props, ref);
});

/** Calendar SVG icon primitive */
export const Calendar: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Calendar(props, ref) {
    return renderIcon('Calendar', props, ref);
  },
);

/** Car SVG icon primitive */
export const Car: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Car(props, ref) {
  return renderIcon('Car', props, ref);
});

/** Check SVG icon primitive */
export const Check: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Check(props, ref) {
  return renderIcon('Check', props, ref);
});

/** CheckCircle SVG icon primitive */
export const CheckCircle: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function CheckCircle(props, ref) {
    return renderIcon('CheckCircle', props, ref);
  },
);

/** ChevronDown SVG icon primitive */
export const ChevronDown: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ChevronDown(props, ref) {
    return renderIcon('ChevronDown', props, ref);
  },
);

/** ChevronLeft SVG icon primitive */
export const ChevronLeft: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ChevronLeft(props, ref) {
    return renderIcon('ChevronLeft', props, ref);
  },
);

/** ChevronRight SVG icon primitive */
export const ChevronRight: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ChevronRight(props, ref) {
    return renderIcon('ChevronRight', props, ref);
  },
);

/** ChevronUp SVG icon primitive */
export const ChevronUp: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ChevronUp(props, ref) {
    return renderIcon('ChevronUp', props, ref);
  },
);

/** Clock SVG icon primitive */
export const Clock: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Clock(props, ref) {
  return renderIcon('Clock', props, ref);
});

/** Compass SVG icon primitive */
export const Compass: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Compass(props, ref) {
    return renderIcon('Compass', props, ref);
  },
);

/** Copy SVG icon primitive */
export const Copy: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Copy(props, ref) {
  return renderIcon('Copy', props, ref);
});

/** CornerDownLeft SVG icon primitive */
export const CornerDownLeft: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function CornerDownLeft(props, ref) {
    return renderIcon('CornerDownLeft', props, ref);
  },
);

/** CornerUpRight SVG icon primitive */
export const CornerUpRight: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function CornerUpRight(props, ref) {
    return renderIcon('CornerUpRight', props, ref);
  },
);

/** Database SVG icon primitive */
export const Database: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Database(props, ref) {
    return renderIcon('Database', props, ref);
  },
);

/** Download SVG icon primitive */
export const Download: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Download(props, ref) {
    return renderIcon('Download', props, ref);
  },
);

/** Edit2 SVG icon primitive */
export const Edit2: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Edit2(props, ref) {
  return renderIcon('Edit2', props, ref);
});

/** Eye SVG icon primitive */
export const Eye: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Eye(props, ref) {
  return renderIcon('Eye', props, ref);
});

/** EyeOff SVG icon primitive */
export const EyeOff: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function EyeOff(props, ref) {
  return renderIcon('EyeOff', props, ref);
});

/** Filter SVG icon primitive */
export const Filter: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Filter(props, ref) {
  return renderIcon('Filter', props, ref);
});

/** FlaskConical SVG icon primitive */
export const FlaskConical: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function FlaskConical(props, ref) {
    return renderIcon('FlaskConical', props, ref);
  },
);

/** Footprints SVG icon primitive */
export const Footprints: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Footprints(props, ref) {
    return renderIcon('Footprints', props, ref);
  },
);

/** GitFork SVG icon primitive */
export const GitFork: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function GitFork(props, ref) {
    return renderIcon('GitFork', props, ref);
  },
);

/** GraduationCap SVG icon primitive */
export const GraduationCap: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function GraduationCap(props, ref) {
    return renderIcon('GraduationCap', props, ref);
  },
);

/** HardDrive SVG icon primitive */
export const HardDrive: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function HardDrive(props, ref) {
    return renderIcon('HardDrive', props, ref);
  },
);

/** Home SVG icon primitive */
export const Home: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Home(props, ref) {
  return renderIcon('Home', props, ref);
});

/** Info SVG icon primitive */
export const Info: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Info(props, ref) {
  return renderIcon('Info', props, ref);
});

/** Layers SVG icon primitive */
export const Layers: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Layers(props, ref) {
  return renderIcon('Layers', props, ref);
});

/** MapPin SVG icon primitive */
export const MapPin: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function MapPin(props, ref) {
  return renderIcon('MapPin', props, ref);
});

/** Milestone SVG icon primitive */
export const Milestone: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Milestone(props, ref) {
    return renderIcon('Milestone', props, ref);
  },
);

/** Moon SVG icon primitive */
export const Moon: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Moon(props, ref) {
  return renderIcon('Moon', props, ref);
});

/** MousePointer SVG icon primitive */
export const MousePointer: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function MousePointer(props, ref) {
    return renderIcon('MousePointer', props, ref);
  },
);

/** Navigation SVG icon primitive */
export const Navigation: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Navigation(props, ref) {
    return renderIcon('Navigation', props, ref);
  },
);

/** Navigation2 SVG icon primitive */
export const Navigation2: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Navigation2(props, ref) {
    return renderIcon('Navigation2', props, ref);
  },
);

/** Octagon SVG icon primitive */
export const Octagon: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Octagon(props, ref) {
    return renderIcon('Octagon', props, ref);
  },
);

/** Paintbrush SVG icon primitive */
export const Paintbrush: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Paintbrush(props, ref) {
    return renderIcon('Paintbrush', props, ref);
  },
);

/** Palette SVG icon primitive */
export const Palette: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Palette(props, ref) {
    return renderIcon('Palette', props, ref);
  },
);

/** Play SVG icon primitive */
export const Play: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Play(props, ref) {
  return renderIcon('Play', props, ref);
});

/** Plus SVG icon primitive */
export const Plus: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Plus(props, ref) {
  return renderIcon('Plus', props, ref);
});

/** RefreshCw SVG icon primitive */
export const RefreshCw: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function RefreshCw(props, ref) {
    return renderIcon('RefreshCw', props, ref);
  },
);

/** RotateCcw SVG icon primitive */
export const RotateCcw: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function RotateCcw(props, ref) {
    return renderIcon('RotateCcw', props, ref);
  },
);

/** Route SVG icon primitive */
export const Route: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Route(props, ref) {
  return renderIcon('Route', props, ref);
});

/** Ruler SVG icon primitive */
export const Ruler: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Ruler(props, ref) {
  return renderIcon('Ruler', props, ref);
});

/** Search SVG icon primitive */
export const Search: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Search(props, ref) {
  return renderIcon('Search', props, ref);
});

/** Settings SVG icon primitive */
export const Settings: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Settings(props, ref) {
    return renderIcon('Settings', props, ref);
  },
);

/** ShieldAlert SVG icon primitive */
export const ShieldAlert: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ShieldAlert(props, ref) {
    return renderIcon('ShieldAlert', props, ref);
  },
);

/** ShoppingBag SVG icon primitive */
export const ShoppingBag: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function ShoppingBag(props, ref) {
    return renderIcon('ShoppingBag', props, ref);
  },
);

/** Sliders SVG icon primitive */
export const Sliders: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Sliders(props, ref) {
    return renderIcon('Sliders', props, ref);
  },
);

/** Square SVG icon primitive */
export const Square: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Square(props, ref) {
  return renderIcon('Square', props, ref);
});

/** Star SVG icon primitive */
export const Star: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Star(props, ref) {
  return renderIcon('Star', props, ref);
});

/** Stethoscope SVG icon primitive */
export const Stethoscope: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Stethoscope(props, ref) {
    return renderIcon('Stethoscope', props, ref);
  },
);

/** Sun SVG icon primitive */
export const Sun: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Sun(props, ref) {
  return renderIcon('Sun', props, ref);
});

/** TrafficCone SVG icon primitive */
export const TrafficCone: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function TrafficCone(props, ref) {
    return renderIcon('TrafficCone', props, ref);
  },
);

/** Train SVG icon primitive */
export const Train: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Train(props, ref) {
  return renderIcon('Train', props, ref);
});

/** Trash2 SVG icon primitive */
export const Trash2: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Trash2(props, ref) {
  return renderIcon('Trash2', props, ref);
});

/** Trees SVG icon primitive */
export const Trees: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Trees(props, ref) {
  return renderIcon('Trees', props, ref);
});

/** Wifi SVG icon primitive */
export const Wifi: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Wifi(props, ref) {
  return renderIcon('Wifi', props, ref);
});

/** WifiOff SVG icon primitive */
export const WifiOff: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function WifiOff(props, ref) {
    return renderIcon('WifiOff', props, ref);
  },
);

/** X SVG icon primitive */
export const X: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function X(props, ref) {
  return renderIcon('X', props, ref);
});

/** Zap SVG icon primitive */
export const Zap: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Zap(props, ref) {
  return renderIcon('Zap', props, ref);
});

/** ZoomIn SVG icon primitive */
export const ZoomIn: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function ZoomIn(props, ref) {
  return renderIcon('ZoomIn', props, ref);
});

/** Pin alias for MapPin */
export const Pin: LucideIcon = forwardRef<SVGSVGElement, IconProps>(function Pin(props, ref) {
  return renderIcon('MapPin', props, ref);
});

/** Chevron alias for ChevronRight */
export const Chevron: LucideIcon = forwardRef<SVGSVGElement, IconProps>(
  function Chevron(props, ref) {
    return renderIcon('ChevronRight', props, ref);
  },
);

const iconRegistry: Record<string, LucideIcon> = {
  Accessibility: Accessibility,
  accessibility: Accessibility,
  accessibility: Accessibility,
  Activity: Activity,
  activity: Activity,
  activity: Activity,
  AlertTriangle: AlertTriangle,
  alerttriangle: AlertTriangle,
  'alert-triangle': AlertTriangle,
  ArrowLeft: ArrowLeft,
  arrowleft: ArrowLeft,
  'arrow-left': ArrowLeft,
  ArrowRight: ArrowRight,
  arrowright: ArrowRight,
  'arrow-right': ArrowRight,
  ArrowUpDown: ArrowUpDown,
  arrowupdown: ArrowUpDown,
  'arrow-up-down': ArrowUpDown,
  Award: Award,
  award: Award,
  award: Award,
  Ban: Ban,
  ban: Ban,
  ban: Ban,
  Bike: Bike,
  bike: Bike,
  bike: Bike,
  Box: Box,
  box: Box,
  box: Box,
  Briefcase: Briefcase,
  briefcase: Briefcase,
  briefcase: Briefcase,
  Bug: Bug,
  bug: Bug,
  bug: Bug,
  Calendar: Calendar,
  calendar: Calendar,
  calendar: Calendar,
  Car: Car,
  car: Car,
  car: Car,
  Check: Check,
  check: Check,
  check: Check,
  CheckCircle: CheckCircle,
  checkcircle: CheckCircle,
  'check-circle': CheckCircle,
  ChevronDown: ChevronDown,
  chevrondown: ChevronDown,
  'chevron-down': ChevronDown,
  ChevronLeft: ChevronLeft,
  chevronleft: ChevronLeft,
  'chevron-left': ChevronLeft,
  ChevronRight: ChevronRight,
  chevronright: ChevronRight,
  'chevron-right': ChevronRight,
  ChevronUp: ChevronUp,
  chevronup: ChevronUp,
  'chevron-up': ChevronUp,
  Clock: Clock,
  clock: Clock,
  clock: Clock,
  Compass: Compass,
  compass: Compass,
  compass: Compass,
  Copy: Copy,
  copy: Copy,
  copy: Copy,
  CornerDownLeft: CornerDownLeft,
  cornerdownleft: CornerDownLeft,
  'corner-down-left': CornerDownLeft,
  CornerUpRight: CornerUpRight,
  cornerupright: CornerUpRight,
  'corner-up-right': CornerUpRight,
  Database: Database,
  database: Database,
  database: Database,
  Download: Download,
  download: Download,
  download: Download,
  Edit2: Edit2,
  edit2: Edit2,
  edit2: Edit2,
  Eye: Eye,
  eye: Eye,
  eye: Eye,
  EyeOff: EyeOff,
  eyeoff: EyeOff,
  'eye-off': EyeOff,
  Filter: Filter,
  filter: Filter,
  filter: Filter,
  FlaskConical: FlaskConical,
  flaskconical: FlaskConical,
  'flask-conical': FlaskConical,
  Footprints: Footprints,
  footprints: Footprints,
  footprints: Footprints,
  GitFork: GitFork,
  gitfork: GitFork,
  'git-fork': GitFork,
  GraduationCap: GraduationCap,
  graduationcap: GraduationCap,
  'graduation-cap': GraduationCap,
  HardDrive: HardDrive,
  harddrive: HardDrive,
  'hard-drive': HardDrive,
  Home: Home,
  home: Home,
  home: Home,
  Info: Info,
  info: Info,
  info: Info,
  Layers: Layers,
  layers: Layers,
  layers: Layers,
  MapPin: MapPin,
  mappin: MapPin,
  'map-pin': MapPin,
  Milestone: Milestone,
  milestone: Milestone,
  milestone: Milestone,
  Moon: Moon,
  moon: Moon,
  moon: Moon,
  MousePointer: MousePointer,
  mousepointer: MousePointer,
  'mouse-pointer': MousePointer,
  Navigation: Navigation,
  navigation: Navigation,
  navigation: Navigation,
  Navigation2: Navigation2,
  navigation2: Navigation2,
  navigation2: Navigation2,
  Octagon: Octagon,
  octagon: Octagon,
  octagon: Octagon,
  Paintbrush: Paintbrush,
  paintbrush: Paintbrush,
  paintbrush: Paintbrush,
  Palette: Palette,
  palette: Palette,
  palette: Palette,
  Play: Play,
  play: Play,
  play: Play,
  Plus: Plus,
  plus: Plus,
  plus: Plus,
  RefreshCw: RefreshCw,
  refreshcw: RefreshCw,
  'refresh-cw': RefreshCw,
  RotateCcw: RotateCcw,
  rotateccw: RotateCcw,
  'rotate-ccw': RotateCcw,
  Route: Route,
  route: Route,
  route: Route,
  Ruler: Ruler,
  ruler: Ruler,
  ruler: Ruler,
  Search: Search,
  search: Search,
  search: Search,
  Settings: Settings,
  settings: Settings,
  settings: Settings,
  ShieldAlert: ShieldAlert,
  shieldalert: ShieldAlert,
  'shield-alert': ShieldAlert,
  ShoppingBag: ShoppingBag,
  shoppingbag: ShoppingBag,
  'shopping-bag': ShoppingBag,
  Sliders: Sliders,
  sliders: Sliders,
  sliders: Sliders,
  Square: Square,
  square: Square,
  square: Square,
  Star: Star,
  star: Star,
  star: Star,
  Stethoscope: Stethoscope,
  stethoscope: Stethoscope,
  stethoscope: Stethoscope,
  Sun: Sun,
  sun: Sun,
  sun: Sun,
  TrafficCone: TrafficCone,
  trafficcone: TrafficCone,
  'traffic-cone': TrafficCone,
  Train: Train,
  train: Train,
  train: Train,
  Trash2: Trash2,
  trash2: Trash2,
  trash2: Trash2,
  Trees: Trees,
  trees: Trees,
  trees: Trees,
  Wifi: Wifi,
  wifi: Wifi,
  wifi: Wifi,
  WifiOff: WifiOff,
  wifioff: WifiOff,
  'wifi-off': WifiOff,
  X: X,
  x: X,
  x: X,
  Zap: Zap,
  zap: Zap,
  zap: Zap,
  ZoomIn: ZoomIn,
  zoomin: ZoomIn,
  'zoom-in': ZoomIn,
  pin: Pin,
  chevron: Chevron,
};

/**
 * Generic dynamic Icon renderer backed by zero-dependency SVG primitives.
 */
export const Icon: React.FC<GenericIconProps> = ({ name, ...props }) => {
  const Component = iconRegistry[name] || iconRegistry[name.toLowerCase()];
  if (!Component) {
    console.warn(`Icon "${name}" not found in icon registry.`);
    return null;
  }
  return <Component {...props} />;
};
