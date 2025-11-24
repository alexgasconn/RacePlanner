
import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { PlannedSector, MapMetric, UnitSystem, GPXPoint } from '../types';

interface MapVisualizerProps {
  sectors: PlannedSector[];
  activeMetric: MapMetric;
  avgPaceSeconds: number;
  units: UnitSystem;
  hoveredDist?: number | null;
  onHover: (dist: number | null) => void;
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({ 
  sectors, 
  activeMetric, 
  avgPaceSeconds, 
  units,
  hoveredDist,
  onHover 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);

  // --- Helpers for Color Scales ---
  const getColor = (sector: PlannedSector): string => {
    switch (activeMetric) {
      case 'gradient':
        const g = sector.avgGradient;
        if (g > 10) return '#b91c1c'; // Extreme
        if (g > 6) return '#ef4444'; // Hard
        if (g > 3) return '#f97316'; // Mod
        if (g > 0) return '#eab308'; // Mild
        if (g > -2) return '#3b82f6'; // Flatish
        return '#22c55e'; // Downhill

      case 'pace':
        const p = sector.targetPaceSeconds;
        const diff = p - avgPaceSeconds;
        if (diff > 15) return '#ef4444'; // Much Slower
        if (diff > 5) return '#f97316'; // Slower
        if (diff < -15) return '#15803d'; // Much Faster
        if (diff < -5) return '#22c55e'; // Faster
        return '#3b82f6'; // Avg

      case 'bank':
         const distKm = sector.endDist / 1000;
         const linearTime = distKm * avgPaceSeconds;
         const bank = linearTime - sector.accumulatedTimeSeconds;
         if (bank > 60) return '#15803d'; // Lots of time banked
         if (bank > 0) return '#22c55e'; // Ahead
         if (bank > -60) return '#f97316'; // Slightly Behind
         return '#ef4444'; // Behind
      
      case 'fatigue':
         const f = sector.fatigueLevel;
         if (f < 20) return '#4ade80'; // Fresh (Green)
         if (f < 40) return '#22c55e'; // Good
         if (f < 60) return '#eab308'; // Moderate (Yellow)
         if (f < 80) return '#f97316'; // Tired (Orange)
         return '#9333ea'; // Exhausted (Purple)

      case 'elevation':
        return '#a855f7'; 

      default:
        return '#3b82f6';
    }
  };

  const getOpacity = (metric: MapMetric) => {
      // Map is dark, we want colors to pop but lines to be visible
      return 0.8;
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

    // FIX: Map sometimes doesn't render tiles correctly if container size changes slightly after mount
    // Double invalidate strategy to catch layout shifts
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
    setTimeout(() => {
        map.invalidateSize();
    }, 500);

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

    // Clear old lines
    polylinesRef.current.forEach(l => l.remove());
    polylinesRef.current = [];

    const bounds = L.latLngBounds([]);

    // We draw one polyline per sector to allow different colors
    sectors.forEach((sector) => {
        const latlngs = sector.points.map(p => [p.lat, p.lon] as [number, number]);
        bounds.extend(latlngs);

        const color = getColor(sector);
        
        const polyline = L.polyline(latlngs, {
            color: color,
            weight: 5,
            opacity: getOpacity(activeMetric),
            className: 'transition-all duration-300' // Smooth color transitions via CSS if class matches
        }).addTo(map);

        // Interaction
        polyline.on('mouseover', (e) => {
             // Broad interaction: Hovering sector
             // But we want precise distance interaction?
             // For now, let's just highlight the sector
             polyline.setStyle({ weight: 8, opacity: 1 });
             onHover(sector.startDist + (sector.endDist - sector.startDist)/2);
        });

        polyline.on('mouseout', () => {
             polyline.setStyle({ weight: 5, opacity: getOpacity(activeMetric) });
             onHover(null);
        });
        
        // Also attach data for precise finding later if needed
        // @ts-ignore
        polyline._sectorData = sector; 

        polylinesRef.current.push(polyline);
    });
    
    // Fit bounds once on load with GENEROUS padding to see full route
    if (polylinesRef.current.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }

  }, [sectors, activeMetric, avgPaceSeconds]); 
  // Re-run when metric changes to recolor

  // 3. Handle Hover Sync (Chart -> Map)
  useEffect(() => {
      const map = mapInstance.current;
      if (!map) return;

      if (hoverMarkerRef.current) {
          hoverMarkerRef.current.remove();
          hoverMarkerRef.current = null;
      }

      if (hoveredDist !== null && hoveredDist !== undefined && sectors.length > 0) {
          // Find the coordinate at this distance
          // 1. Find sector
          const sector = sectors.find(s => hoveredDist >= s.startDist && hoveredDist <= s.endDist);
          if (sector) {
              // 2. Interpolate within points
              // Simple approximation: find closest point in sector
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
                      fillColor: '#60a5fa', // Blue-400
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
        <div className="absolute bottom-4 left-4 z-[500] bg-slate-900/90 backdrop-blur-md border border-slate-700 p-3 rounded-lg text-xs shadow-xl">
             <div className="font-bold text-white mb-2 uppercase tracking-wider">{activeMetric} Map</div>
             <div className="flex flex-col gap-1">
                 {activeMetric === 'gradient' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded-full"></div> <span>&gt;10% (Extreme)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> <span>3-10% (Climb)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> <span>Flat</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> <span>Downhill</span></div>
                     </>
                 )}
                 {activeMetric === 'pace' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> <span>Slower than Avg</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> <span>Average</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> <span>Faster than Avg</span></div>
                     </>
                 )}
                  {activeMetric === 'bank' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> <span>Ahead (Banked)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> <span>On Track</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> <span>Behind</span></div>
                     </>
                 )}
                 {activeMetric === 'fatigue' && (
                     <>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> <span>Fresh (0-40%)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div> <span>Tired (40-60%)</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-600 rounded-full"></div> <span>Exhausted (80%+)</span></div>
                     </>
                 )}
             </div>
        </div>
    </div>
  );
};

export default MapVisualizer;
