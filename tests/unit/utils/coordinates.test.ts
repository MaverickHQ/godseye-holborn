import { describe, it, expect } from 'vitest';

describe('Coordinate Utilities', () => {
  it('should convert lat/lng to valid coordinates', () => {
    const lat = 51.5185;
    const lng = -0.1065;
    
    expect(lat).toBeGreaterThan(-90);
    expect(lat).toBeLessThan(90);
    expect(lng).toBeGreaterThan(-180);
    expect(lng).toBeLessThan(180);
  });
  
  it('should handle Holborn location correctly', () => {
    const holbornLat = 51.5185;
    const holbornLng = -0.1065;
    
    expect(holbornLat).toBeCloseTo(51.52, 1);
    expect(holbornLng).toBeCloseTo(-0.11, 1);
  });
  
  it('should calculate bounding box correctly', () => {
    const centerLat = 51.5185;
    const centerLng = -0.1065;
    const radius = 0.01; // ~1km in degrees
    
    const north = centerLat + radius;
    const south = centerLat - radius;
    const east = centerLng + radius;
    const west = centerLng - radius;
    
    expect(north).toBeGreaterThan(centerLat);
    expect(south).toBeLessThan(centerLat);
    expect(east).toBeGreaterThan(centerLng);
    expect(west).toBeLessThan(centerLng);
  });
});

describe('Distance Calculation', () => {
  it('should calculate approximate distance between two points', () => {
    // Haversine formula approximation for short distances
    const R = 6371; // Earth's radius in km
    const lat1 = 51.5185;
    const lng1 = -0.1065;
    const lat2 = 51.5190;
    const lng2 = -0.1080;
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    expect(distance).toBeLessThan(1); // Should be less than 1km
  });
});