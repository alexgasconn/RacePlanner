import { UnitSystem } from '../types';

export const METERS_TO_FEET = 3.28084;
export const KM_TO_MILES = 0.621371;

export const formatDistance = (meters: number, units: UnitSystem, decimals: number = 2): string => {
  if (units === 'metric') {
    return (meters / 1000).toFixed(decimals);
  } else {
    return ((meters / 1000) * KM_TO_MILES).toFixed(decimals);
  }
};

export const formatElevation = (meters: number, units: UnitSystem): string => {
  if (units === 'metric') {
    return Math.round(meters).toString();
  } else {
    return Math.round(meters * METERS_TO_FEET).toString();
  }
};

export const formatPace = (secondsPerKm: number, units: UnitSystem): string => {
  let seconds = secondsPerKm;
  if (units === 'imperial') {
    seconds = secondsPerKm / KM_TO_MILES; // seconds per mile
  }

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}/${units === 'metric' ? 'km' : 'mi'}`;
};

export const getUnitLabel = (type: 'dist' | 'ele' | 'pace', units: UnitSystem): string => {
  if (type === 'dist') return units === 'metric' ? 'km' : 'mi';
  if (type === 'ele') return units === 'metric' ? 'm' : 'ft';
  if (type === 'pace') return units === 'metric' ? 'min/km' : 'min/mi';
  return '';
};

export const convertDistanceInputToMeters = (val: number, units: UnitSystem): number => {
    return units === 'metric' ? val * 1000 : (val / KM_TO_MILES) * 1000;
};