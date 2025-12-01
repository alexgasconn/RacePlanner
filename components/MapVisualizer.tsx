
import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { PlannedSector, MapMetric, UnitSystem, GPXPoint, AidStation } from '../types';
import { KM_TO_MILES } from '../utils/unitUtils';

interface MapVisualizerProps {
  sectors: PlannedSector[];
  activeMetric: MapMetric;
  avgPaceSeconds: number;
  units: UnitSystem;
  hoveredDist?: number | null;
  onHover: (dist: number | null) => void;
  aidStations?: AidStation[];
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({ 
  sectors, 
  activeMetric, 
  avgPaceSeconds, 
  units,
  hoveredDist,
  onHover,
  aidStations = []
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);
  const aidMarkersRef = useRef<L.Marker[]>([]);

  // --- Helpers for Color Scales ---
  const getColor = (sector: PlannedSector): string => {
    switch (activeMetric) {
      case 'gradient':
        // New Palette:
        const g = sector.avgGradient;
        if (g > 10) return '#dc2626'; // Steep Climb
        if (g > 5)  return '#fb923c'; // Mod Climb
        if (g > 1)  return '#fcd34d'; // Light Climb
        if (g >= -1) return '#60a5fa'; // Flat
        if (g >= -5) return '#34d399'; // Light Desc
        if (g >= -10) return '#2dd4bf'; // Mod Desc
        return '#0d9488';             // Steep Desc

      case 'pace':
        const p = sector.targetPaceSeconds;
        const diff = p - avgPaceSeconds;
        if (diff > 15) return '#ef4444'; // Much Slower
        if (diff > 5) return '#f97316'; // Slower
        if (diff < -15) return '#0d9488'; // Much Faster
        if (diff < -5) return '#34d399'; // Faster
        return '#60a5fa'; // Avg

      case 'bank':
         const distKm = sector.endDist / 1000;
         const linearTime = distKm * avgPaceSeconds;
         const bank = linearTime - sector.accumulatedTimeSeconds;
         if (bank > 60) return '#0d9488'; // Lots of time banked
         if (bank > 0) return '#34d399'; // Ahead
         if (bank > -60) return '#fb923c'; // Slightly Behind
         return '#dc2626'; // Behind
      
      case 'fatigue':
         const f = sector.fatigueLevel;
         if (f < 20) return '#34d399'; // Fresh (Green)
         if (f < 40) return '#60a5fa'; // Good (Blue)
         if (f < 60) return '#fcd34d'; // Moderate (Yellow)
         if (f < 80) return '#fb923c'; // Tired (Orange)
         return '#dc2626'; // Exhausted (Red)

      case 'elevation':
        return '#a855f7'; 

      default:
        return '#60a5fa';
    }
  };

  const getOpacity = (metric: MapMetric) => {
      return 0.9;
  }

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
    });

    // Dark Matter Tiles (CartoDB) - Perfect for "High Transparency" / Dark look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      opacity: 0.9
    }).addTo(map);

    L.control.attribution({ position: 'bottomright' }).addTo(map);

    mapInstance.current = map;

    const forceResizeAndFit = () => {
        map.invalidateSize();
        if (polylinesRef.current.length > 0) {
            const group = L.featureGroup(polylinesRef.current);
            if (group.getLayers().length > 0) {
                 map.fitBounds(group.getBounds(), { padding: [50, 50], animate: false });
            }
        }
    };

    setTimeout(forceResizeAndFit, 200);
    setTimeout(forceResizeAndFit, 500);
    setTimeout(forceResizeAndFit, 1000);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // 2. Draw Route
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !sectors.length) return;

    polylinesRef.current.forEach(l => l.remove());
    polylinesRef.current = [];

    const bounds = L.latLngBounds([]);

    sectors.forEach((sector) => {
        const latlngs = sector.points.map(p => [p.lat, p.lon] as [number, number]);
        bounds.extend(latlngs);

        const color = getColor(sector);
        
        const polyline = L.polyline(latlngs, {
            color: color,
            weight: 5,
            opacity: getOpacity(activeMetric),
            className: 'transition-all duration-300' 
        }).addTo(map);

        polyline.on('mouseover', (e) => {
             polyline.setStyle({ weight: 8, opacity: 1 });
             onHover(sector.startDist + (sector.endDist - sector.startDist)/2);
        });

        polyline.on('mouseout', () => {
             polyline.setStyle({ weight: 5, opacity: getOpacity(activeMetric) });
             onHover(null);
        });
        
        // @ts-ignore
        polyline._sectorData = sector; 

        polylinesRef.current.push(polyline);
    });
    
    if (polylinesRef.current.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }

  }, [sectors, activeMetric, avgPaceSeconds]); 


  // 3. Draw Aid Stations
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    aidMarkersRef.current.forEach(m => m.remove());
    aidMarkersRef.current = [];

    if (aidStations.length > 0 && sectors.length > 0) {
        const aidIcon = L.divIcon({
            className: 'bg-transparent',
            html: `
                <div class="relative flex items-center justify-center">
                    <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 22a7 7 0 0 0 7-7c0-2-2-3.9-7-11.9-5 8-7 9.9-7 11.9a7 7 0 0 0 7 7z"/></svg>
                    </div>
                    <div class="absolute -bottom-1 w-2 h-2 bg-blue-500 transform rotate-45"></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 28] 
        });

        aidStations.forEach(station => {
            const targetMeters = units === 'metric' ? station.distanceFromStart * 1000 : (station.distanceFromStart / KM_TO_MILES) * 1000;
            const sector = sectors.find(s => targetMeters >= s.startDist && targetMeters <= s.endDist);
            if (sector && sector.points.length > 0) {
                let closestP: GPXPoint | null = null;
                let minDiff = Infinity;
                for (const p of sector.points) {
                    const d = Math.abs(p.distFromStart - targetMeters);
                    if (d < minDiff) {
                        minDiff = d;
                        closestP = p;
                    }
                }

                if (closestP) {
                    const marker = L.marker([closestP.lat, closestP.lon], { icon: aidIcon, zIndexOffset: 1000 }).addTo(map);
                    marker.bindPopup(`
                        <div class="text-slate-800 font-sans p-1">
                            <div class="font-bold text-sm">Aid Station</div>
                            <div class="text-xs">Distance: ${station.distanceFromStart} ${units === 'metric' ? 'km' : 'mi'}</div>
                            <div class="text-xs">Stop: ${station.penaltySeconds}s</div>
                        </div>
                    `);
                    aidMarkersRef.current.push(marker);
                }
            }
        });
    }

  }, [sectors, aidStations, units]);


  // 4. Handle Hover Sync (Chart -> Map)
  useEffect(() => {
      const map = mapInstance.current;
      if (!map) return;

      if (hoverMarkerRef.current) {
          hoverMarkerRef.current.remove();
          hoverMarkerRef.current = null;
      }

      if (hoveredDist !== null && hoveredDist !== undefined && sectors.length > 0) {
          const sector = sectors.find(s => hoveredDist >= s.startDist && hoveredDist <= s.endDist);
          if (sector) {
              let closestP: GPXPoint | null = null;
              let minDiff = Infinity;
              
              for (const p of sector.points) {
                  const diff = Math.abs(p.distFromStart - hoveredDist);
                  if (diff < minDiff) {
                      minDiff = diff;
                      closestP = p;
                  }
              }

              if (closestP) {
                  hoverMarkerRef.current = L.circleMarker([closestP.lat, closestP.lon], {
                      radius: 8,
                      fillColor: '#60a5fa', 
                      color: '#fff',
                      weight: 2,
                      opacity: 1,
                      fillOpacity: 0.8
                  }).addTo(map);
              }
          }
      }
  }, [hoveredDist, sectors]);


  return (
    <div className="w-full h-full relative z-0">
        <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" style={{ background: '#0f172a' }} />
        
        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[500] bg-slate-900/90 backdrop-blur-md border border-slate-700 p-3 rounded-lg text-xs shadow-xl pointer-events-none">
             <div className="font-bold text-white mb-2 uppercase tracking-wider">{activeMetric} Map</div>
             <div className="flex flex-col gap-1">
                 {activeMetric === 'gradient' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#dc2626'}}></div> <span>&gt;10% (Steep Climb)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#fb923c'}}></div> <span>5-10% (Mod Climb)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#fcd34d'}}></div> <span>1-5% (Light Climb)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#60a5fa'}}></div> <span>Flat</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#34d399'}}></div> <span>-1 to -5% (Light Desc)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#2dd4bf'}}></div> <span>-5 to -10% (Mod Desc)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#0d9488'}}></div> <span>&lt;-10% (Steep Desc)</span></div>
                     </>
                 )}
                 {activeMetric === 'pace' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#ef4444'}}></div> <span>Much Slower</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#60a5fa'}}></div> <span>Average</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#0d9488'}}></div> <span>Much Faster</span></div>
                     </>
                 )}
                  {activeMetric === 'bank' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#34d399'}}></div> <span>Ahead</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#ef4444'}}></div> <span>Behind</span></div>
                     </>
                 )}
                 {activeMetric === 'fatigue' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#34d399'}}></div> <span>Fresh</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#fcd34d'}}></div> <span>Tired</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#dc2626'}}></div> <span>Exhausted</span></div>
                     </>
                 )}
             </div>
        </div>
    </div>
  );
};

export default MapVisualizer;
