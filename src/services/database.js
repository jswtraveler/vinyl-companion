import { openDB } from 'idb';

const DB_NAME = 'VinylCollection';
const DB_VERSION = 1;

const dbSchema = {
  albums: 'id, title, artist, year, genre',
  cache: 'key, data, timestamp',
  images: 'albumId, imageData',
  audio: 'albumId, fingerprint'
};

let dbInstance = null;

export const initDatabase = async () => {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Albums store
        if (!db.objectStoreNames.contains('albums')) {
          const albumStore = db.createObjectStore('albums', { keyPath: 'id' });
          albumStore.createIndex('title', 'title');
          albumStore.createIndex('artist', 'artist'); 
          albumStore.createIndex('year', 'year');
          albumStore.createIndex('dateAdded', 'dateAdded');
        }

        // Cache store for API responses
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp');
        }

        // Images store for album covers
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'albumId' });
        }

        // Audio fingerprints store
        if (!db.objectStoreNames.contains('audio')) {
          const audioStore = db.createObjectStore('audio', { keyPath: 'albumId' });
        }
      },
    });

    console.log('Database initialized successfully');
    return dbInstance;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// Album CRUD operations
export const addAlbum = async (album) => {
  try {
    if (!album || !album.title || !album.artist) {
      throw new Error('Album must have title and artist');
    }

    const db = await initDatabase();
    const tx = db.transaction('albums', 'readwrite');
    
    const albumToSave = {
      ...album,
      id: album.id || `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dateAdded: album.dateAdded || new Date().toISOString()
    };

    await tx.objectStore('albums').add(albumToSave);
    await tx.complete;
    
    console.log('Album added successfully:', albumToSave.title);
    return albumToSave;
  } catch (error) {
    console.error('Failed to add album:', error);
    if (error.name === 'ConstraintError') {
      throw new Error('Album with this ID already exists');
    }
    throw new Error(`Failed to add album: ${error.message}`);
  }
};

export const getAlbum = async (id) => {
  try {
    if (!id) throw new Error('Album ID is required');
    
    const db = await initDatabase();
    const album = await db.get('albums', id);
    
    if (!album) {
      console.warn(`Album with ID ${id} not found`);
    }
    
    return album;
  } catch (error) {
    console.error('Failed to get album:', error);
    throw new Error(`Failed to retrieve album: ${error.message}`);
  }
};

export const getAllAlbums = async () => {
  try {
    const db = await initDatabase();
    const albums = await db.getAll('albums');
    
    console.log(`Retrieved ${albums.length} albums from database`);
    return albums.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  } catch (error) {
    console.error('Failed to get all albums:', error);
    throw new Error(`Failed to retrieve albums: ${error.message}`);
  }
};

export const updateAlbum = async (album) => {
  try {
    if (!album || !album.id) {
      throw new Error('Album must have an ID for updates');
    }
    if (!album.title || !album.artist) {
      throw new Error('Album must have title and artist');
    }

    const db = await initDatabase();
    
    // Check if album exists
    const existing = await db.get('albums', album.id);
    if (!existing) {
      throw new Error('Album not found');
    }

    const tx = db.transaction('albums', 'readwrite');
    const updatedAlbum = {
      ...album,
      dateModified: new Date().toISOString()
    };
    
    await tx.objectStore('albums').put(updatedAlbum);
    await tx.complete;
    
    console.log('Album updated successfully:', updatedAlbum.title);
    return updatedAlbum;
  } catch (error) {
    console.error('Failed to update album:', error);
    throw new Error(`Failed to update album: ${error.message}`);
  }
};

export const deleteAlbum = async (id) => {
  try {
    if (!id) throw new Error('Album ID is required');
    
    const db = await initDatabase();
    
    // Check if album exists
    const existing = await db.get('albums', id);
    if (!existing) {
      throw new Error('Album not found');
    }

    const tx = db.transaction(['albums', 'images', 'audio'], 'readwrite');
    
    await tx.objectStore('albums').delete(id);
    await tx.objectStore('images').delete(id);
    await tx.objectStore('audio').delete(id);
    
    await tx.complete;
    
    console.log('Album deleted successfully:', existing.title);
    return existing;
  } catch (error) {
    console.error('Failed to delete album:', error);
    throw new Error(`Failed to delete album: ${error.message}`);
  }
};

// Search functionality
export const searchAlbums = async (query) => {
  const albums = await getAllAlbums();
  const lowercaseQuery = query.toLowerCase();
  
  return albums.filter(album => 
    album.title.toLowerCase().includes(lowercaseQuery) ||
    album.artist.toLowerCase().includes(lowercaseQuery) ||
    (album.genre && album.genre.some(g => g.toLowerCase().includes(lowercaseQuery)))
  );
};

// Cache operations
export const getCacheItem = async (key) => {
  const db = await initDatabase();
  const item = await db.get('cache', key);
  
  if (!item) return null;
  
  // Check if cache item is expired (7 days)
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - item.timestamp > maxAge) {
    await db.delete('cache', key);
    return null;
  }
  
  return item.data;
};

export const setCacheItem = async (key, data) => {
  const db = await initDatabase();
  await db.put('cache', {
    key,
    data,
    timestamp: Date.now()
  });
};

// Image operations
export const saveAlbumImage = async (albumId, imageData) => {
  const db = await initDatabase();
  await db.put('images', { albumId, imageData });
};

export const getAlbumImage = async (albumId) => {
  const db = await initDatabase();
  const result = await db.get('images', albumId);
  return result?.imageData;
};

// Export/Import functionality
export const exportData = async () => {
  const albums = await getAllAlbums();
  return {
    albums,
    exportDate: new Date().toISOString(),
    version: DB_VERSION
  };
};

export const importData = async (data) => {
  if (!data.albums) throw new Error('Invalid import data');
  
  const db = await initDatabase();
  const tx = db.transaction('albums', 'readwrite');
  
  for (const album of data.albums) {
    await tx.objectStore('albums').put(album);
  }
  
  await tx.complete;
  return data.albums.length;
};