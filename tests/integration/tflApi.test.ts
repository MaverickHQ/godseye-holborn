/**
 * Integration tests for TfL API
 * 
 * These tests verify the TfL API integration.
 * Note: TfL API requires an API key (VITE_TFL_API_KEY).
 * If no key is configured, tests will be skipped.
 * 
 * Run with: npm test -- tests/integration/tflApi.test.ts
 */
import { describe, it, expect } from 'vitest';
import { getAllTrafficCameras, getCameraById } from '@/services/tflApi';

describe('TfL API Integration', () => {
  describe('getAllTrafficCameras', () => {
    it('should return a list of traffic cameras', async () => {
      const cameras = await getAllTrafficCameras();
      
      expect(Array.isArray(cameras)).toBe(true);
      expect(cameras.length).toBeGreaterThan(0);
    });

    it('should return cameras with required properties', async () => {
      const cameras = await getAllTrafficCameras();
      
      if (cameras.length > 0) {
        const camera = cameras[0];
        
        // Required properties
        expect(camera).toHaveProperty('id');
        expect(camera).toHaveProperty('name');
        expect(camera).toHaveProperty('type');
        expect(camera).toHaveProperty('provider');
        expect(camera).toHaveProperty('coordinates');
        expect(camera).toHaveProperty('status');
        
        // Type should be traffic
        expect(camera.type).toBe('traffic');
        
        // Provider should be tfl
        expect(camera.provider).toBe('tfl');
        
        // Coordinates should have lat/lng
        expect(camera.coordinates).toHaveProperty('lat');
        expect(camera.coordinates).toHaveProperty('lng');
        expect(typeof camera.coordinates.lat).toBe('number');
        expect(typeof camera.coordinates.lng).toBe('number');
        
        // Status should be valid
        expect(['active', 'inactive', 'unknown']).toContain(camera.status);
      }
    });

    it('should include cameras near Holborn area', async () => {
      const cameras = await getAllTrafficCameras();
      
      // Should have cameras in central London area
      // Holborn is roughly lat: 51.51-51.52, lng: -0.11 to -0.12
      const londonCameras = cameras.filter(c => 
        c.coordinates.lat >= 51.4 && c.coordinates.lat <= 51.6 &&
        c.coordinates.lng >= -0.2 && c.coordinates.lng <= 0.1
      );
      
      expect(londonCameras.length).toBeGreaterThan(0);
    });
  });

  describe('getCameraById', () => {
    it('should return a camera by ID', async () => {
      // First get all cameras to get a valid ID
      const cameras = await getAllTrafficCameras();
      const firstCameraId = cameras[0].id;
      
      const camera = await getCameraById(firstCameraId);
      
      expect(camera).not.toBeNull();
      if (camera) {
        expect(camera.id).toBe(firstCameraId);
      }
    });

    it('should return null for non-existent camera', async () => {
      const camera = await getCameraById('non-existent-camera-id');
      
      expect(camera).toBeNull();
    });
  });
});
