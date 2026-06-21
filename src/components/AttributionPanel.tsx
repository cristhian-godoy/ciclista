import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import React, { useState } from 'react';

interface AttributionItem {
  name: string;
  license: string;
  description: string;
  link: string;
}

const ATTRIBUTIONS: AttributionItem[] = [
  {
    name: 'OpenStreetMap',
    license: 'ODbL',
    description: 'Map data and geographic features.',
    link: 'https://www.openstreetmap.org/copyright',
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
    name: 'Vite, TypeScript & ESLint',
    license: 'MIT',
    description: 'Development tooling and compiler.',
    link: 'https://vitejs.dev',
  },
];

/**
 * Accordion-style panel displaying attribution data for third-party dependencies.
 */
export const AttributionPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="ciclista-card attribution-panel" style={{ marginTop: '16px' }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="attribution-panel-header"
        aria-expanded={isOpen}
      >
        <span className="attribution-panel-title">
          <Info size={14} className="attribution-icon" />
          <span>Attributions</span>
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="attribution-list">
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
        </div>
      )}
    </section>
  );
};
