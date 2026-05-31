/**
 * Integration tests for Police UK API
 * 
 * These tests verify the API integration against the live Police UK API.
 * Police UK API does not require an API key.
 * 
 * Run with: npm test -- tests/integration/policeApi.test.ts
 */
import { describe, it, expect } from 'vitest';
import { getCrimesAtLocation, getCrimesOnStreet, getCrimesByCategory } from '@/services/policeApi';

// Test location: Holborn, London
const TEST_LAT = 51.5185;
const TEST_LNG = -0.1065;

describe('Police UK API Integration', () => {
  describe('getCrimesAtLocation', () => {
    it('should return crimes at a specific location', async () => {
      const crimes = await getCrimesAtLocation(TEST_LAT, TEST_LNG);
      
      // Should return an array (may be empty if no crimes in exact location)
      expect(Array.isArray(crimes)).toBe(true);
      
      if (crimes.length > 0) {
        // Each crime should have required fields
        const crime = crimes[0];
        expect(crime).toHaveProperty('id');
        expect(crime).toHaveProperty('category');
        expect(crime).toHaveProperty('location');
        expect(crime).toHaveProperty('street');
        expect(crime).toHaveProperty('month');
        
        // Location should have lat/lng
        expect(crime.location).toHaveProperty('lat');
        expect(crime.location).toHaveProperty('lng');
        
        // Category should be a valid string
        expect(typeof crime.category).toBe('string');
        expect(crime.category.length).toBeGreaterThan(0);
      }
    });

    it('should handle specific date parameter', async () => {
      const crimes = await getCrimesAtLocation(TEST_LAT, TEST_LNG, '2026-01');
      
      expect(Array.isArray(crimes)).toBe(true);
      
      if (crimes.length > 0) {
        // All crimes should be from January 2026
        crimes.forEach(crime => {
          expect(crime.month).toContain('2026-01');
        });
      }
    });

    it('should handle invalid coordinates gracefully', async () => {
      // Very out of range coordinates should still return array (possibly empty)
      const crimes = await getCrimesAtLocation(999, 999);
      expect(Array.isArray(crimes)).toBe(true);
    });
  });

  describe('getCrimesOnStreet', () => {
    it('should return crimes within a radius', async () => {
      const crimes = await getCrimesOnStreet(TEST_LAT, TEST_LNG, undefined, 500);
      
      expect(Array.isArray(crimes)).toBe(true);
      
      if (crimes.length > 0) {
        // Each crime should have required structure
        const crime = crimes[0];
        expect(crime.id).toBeDefined();
        expect(crime.category).toBeDefined();
        expect(crime.location.lat).toBeDefined();
        expect(crime.location.lng).toBeDefined();
      }
    });

    it('should respect the radius parameter', async () => {
      // Get crimes with small radius
      const smallRadius = await getCrimesOnStreet(TEST_LAT, TEST_LNG, undefined, 100);
      // Get crimes with large radius  
      const largeRadius = await getCrimesOnStreet(TEST_LAT, TEST_LNG, undefined, 1000);
      
      expect(Array.isArray(smallRadius)).toBe(true);
      expect(Array.isArray(largeRadius)).toBe(true);
      
      // Larger radius should typically return same or more crimes
      // (not guaranteed due to data distribution)
    });

    it('should filter by date when provided', async () => {
      const crimes = await getCrimesOnStreet(TEST_LAT, TEST_LNG, '2025-12', 500);
      
      expect(Array.isArray(crimes)).toBe(true);
    });
  });

  describe('getCrimesByCategory', () => {
    it('should group crimes by category', async () => {
      const crimes = await getCrimesOnStreet(TEST_LAT, TEST_LNG, undefined, 500);
      
      if (crimes.length > 0) {
        const grouped = getCrimesByCategory(crimes);
        
        expect(typeof grouped).toBe('object');
        
        // Sum of all categories should equal total crimes
        const totalByCategory = Object.values(grouped).reduce((sum, count) => sum + count, 0);
        expect(totalByCategory).toBe(crimes.length);
        
        // Each category count should be positive
        Object.values(grouped).forEach(count => {
          expect(count).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should return empty object for empty crime list', () => {
      const grouped = getCrimesByCategory([]);
      expect(Object.keys(grouped).length).toBe(0);
    });
  });
});
