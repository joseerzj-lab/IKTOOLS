import { compress, decompress } from 'lz-string';

/**
 * Saves data to localStorage with LZ-string compression.
 */
export const saveToStorage = (key: string, data: any) => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = compress(jsonString);
    localStorage.setItem(key, compressed);
  } catch (error) {
    console.error(`Error saving to localStorage for key ${key}:`, error);
    // Fallback to uncompressed if quota allows, though unlikely if compressed failed
  }
};

/**
 * Loads and decompresses data from localStorage.
 */
export const loadFromStorage = (key: string) => {
  try {
    const compressed = localStorage.getItem(key);
    if (!compressed) return null;
    
    // Try decompressing. Older data might be uncompressed JSON.
    const decompressed = decompress(compressed);
    if (decompressed) {
      return JSON.parse(decompressed);
    }
    
    // Fallback for transition period (if data wasn't compressed)
    return JSON.parse(compressed);
  } catch (error) {
    console.error(`Error loading from localStorage for key ${key}:`, error);
    return null;
  }
};
