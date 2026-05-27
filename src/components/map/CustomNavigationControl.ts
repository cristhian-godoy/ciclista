import type { IControl } from 'maplibre-gl';
import { Map } from 'maplibre-gl';

/**
 * Custom navigation control that replaces MapLibre's built-in NavigationControl.
 * Provides zoom in/out buttons and a compass needle that tracks map bearing.
 */
export class CustomNavigationControl implements IControl {
  private _map: Map | undefined;
  private _container: HTMLDivElement;
  private _zoomInButton: HTMLButtonElement;
  private _zoomOutButton: HTMLButtonElement;
  private _compassButton: HTMLButtonElement;
  private _compassIcon: HTMLSpanElement;

  /** Constructs the control DOM: zoom-in, zoom-out, and compass buttons. */
  constructor() {
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    this._zoomInButton = this._createButton('maplibregl-ctrl-zoom-in', 'Zoom in', () => {
      this._map?.zoomIn();
    });

    this._zoomOutButton = this._createButton('maplibregl-ctrl-zoom-out', 'Zoom out', () => {
      this._map?.zoomOut();
    });

    this._compassButton = this._createButton(
      'maplibregl-ctrl-compass',
      'Drag to rotate map, click to reset north',
      () => {
        this._map?.resetNorth();
      },
    );

    // Inject compass needle SVG; viewBox is cropped to maximize needle size within the button
    this._compassIcon = this._compassButton.querySelector(
      '.maplibregl-ctrl-icon',
    ) as HTMLSpanElement;
    this._compassIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="15 15 70 70" width="23" height="23" style="display: block; margin: auto;">
        <path d="M50,20 L62.5,50 L50,45 L37.5,50 Z" fill="#ff4d4d"/>
        <path d="M50,80 L62.5,50 L50,55 L37.5,50 Z" fill="#f1f1f4"/>
      </svg>`;
  }

  private _createButton(className: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.setAttribute('aria-disabled', 'false');

    const icon = document.createElement('span');
    icon.className = 'maplibregl-ctrl-icon';
    icon.setAttribute('aria-hidden', 'true');

    button.appendChild(icon);
    button.addEventListener('click', onClick);

    this._container.appendChild(button);
    return button;
  }

  /** Registers map event listeners for bearing rotation and zoom state tracking. */
  onAdd(map: Map): HTMLElement {
    this._map = map;
    this._map.on('rotate', this._onRotate);
    this._map.on('zoom', this._updateZoomButtons);
    this._onRotate();
    this._updateZoomButtons();
    return this._container;
  }

  /** Detaches event listeners and removes the control container from the DOM. */
  onRemove(): void {
    if (this._map) {
      this._map.off('rotate', this._onRotate);
      this._map.off('zoom', this._updateZoomButtons);
    }
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }

  private _updateZoomButtons = () => {
    if (!this._map) return;
    const zoom = this._map.getZoom();
    const isMax = zoom === this._map.getMaxZoom();
    const isMin = zoom === this._map.getMinZoom();

    this._zoomInButton.disabled = isMax;
    this._zoomInButton.setAttribute('aria-disabled', isMax.toString());

    this._zoomOutButton.disabled = isMin;
    this._zoomOutButton.setAttribute('aria-disabled', isMin.toString());
  };

  private _onRotate = () => {
    if (this._map && this._compassIcon) {
      // Maplibre's bearing is positive clockwise.
      // To keep the compass pointing North, we rotate the needle counter-clockwise.
      this._compassIcon.style.transform = `rotate(${this._map.getBearing() * -1}deg)`;
    }
  };
}
