import { Info } from 'lucide-react';
import React from 'react';

import { AccordionSection } from './common/AccordionSection';

interface AttributionItem {
  name: string;
  license: string;
  description: string;
  link: string;
}

const ATTRIBUTIONS: readonly AttributionItem[] = [
  {
    name: 'OpenStreetMap',
    license: 'ODbL',
    description: 'Map data and geographic features.',
    link: 'https://www.openstreetmap.org/copyright',
  },
  {
    name: 'OpenFreeMap',
    license: 'MIT',
    description: 'Map tiles and styles hosting.',
    link: 'https://openfreemap.org/',
  },
  {
    name: 'Overpass API',
    license: 'AGPL',
    description: 'Query API used to fetch OpenStreetMap data.',
    link: 'https://overpass-api.de/',
  },
  {
    name: 'MapLibre GL JS',
    license: 'BSD 3-Clause',
    description: 'WebGL-based map rendering engine.',
    link: 'https://maplibre.org',
  },
  {
    name: 'React & React DOM',
    license: 'MIT',
    description: 'Core application UI library.',
    link: 'https://react.dev',
  },
  {
    name: 'Lucide React',
    license: 'ISC',
    description: 'UI icons.',
    link: 'https://lucide.dev',
  },
  {
    name: 'Google Fonts',
    license: 'OFL',
    description: 'Inter and Outfit fonts.',
    link: 'https://fonts.google.com/',
  },
  {
    name: 'Vite, TypeScript & ESLint',
    license: 'MIT',
    description: 'Development tooling and compiler.',
    link: 'https://vitejs.dev',
  },
] as const;

/**
 * Accordion-style panel displaying attribution data for third-party dependencies.
 */
export const AttributionPanel: React.FC = () => {
  return (
    <section className="ciclista-card attribution-panel">
      <AccordionSection
        title="Attributions"
        icon={<Info size={14} className="attribution-icon" />}
        className="attribution-accordion"
        headerClassName="attribution-panel-header"
        bodyClassName="attribution-list"
        chevronSize={14}
      >
        {ATTRIBUTIONS.map((item) => (
          <div key={item.name} className="attribution-item">
            <div className="attribution-item-header">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="attribution-link"
              >
                {item.name}
              </a>
              <span className="attribution-license">{item.license}</span>
            </div>
            <p className="attribution-desc">{item.description}</p>
          </div>
        ))}
      </AccordionSection>
    </section>
  );
};
