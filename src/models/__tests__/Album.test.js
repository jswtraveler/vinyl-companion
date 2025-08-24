import { describe, it, expect } from 'vitest'
import { createNewAlbum, validateAlbum, ALBUM_FORMATS, RECORD_SPEEDS, CONDITION_GRADES, MUSIC_GENRES } from '../Album.js'

describe('Album Model', () => {
  describe('createNewAlbum', () => {
    it('creates a new album with default values', () => {
      const album = createNewAlbum()
      
      expect(album).toHaveProperty('id')
      expect(album.title).toBe('')
      expect(album.artist).toBe('')
      expect(album.format).toBe('LP')
      expect(album.speed).toBe('33⅓ RPM')
      expect(album.condition).toBe('Very Good (VG)')
      expect(album.genre).toEqual([])
      expect(album.tracks).toEqual([])
      expect(typeof album.dateAdded).toBe('string')
    })

    it('creates a new album with provided data', () => {
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        year: 2023
      }
      
      const album = createNewAlbum(albumData)
      
      expect(album.title).toBe('Test Album')
      expect(album.artist).toBe('Test Artist')
      expect(album.year).toBe(2023)
    })
  })

  describe('validateAlbum', () => {
    it('validates a complete album successfully', () => {
      const album = createNewAlbum({
        title: 'Valid Album',
        artist: 'Valid Artist',
        year: 2023,
        format: 'LP',
        speed: '33⅓ RPM',
        condition: 'Very Good (VG)',
        genre: ['Rock']
      })
      
      const result = validateAlbum(album)
      expect(result.errors).toEqual([])
      expect(result.isValid).toBe(true)
    })

    it('returns errors for missing required fields', () => {
      const album = {
        title: '',
        artist: '',
        year: null
      }
      
      const result = validateAlbum(album)
      expect(result.errors).toContain('Album title is required')
      expect(result.errors).toContain('Artist name is required')
      expect(result.errors).toContain('Album ID is required')
      expect(result.isValid).toBe(false)
    })

    it('validates enum values', () => {
      const album = createNewAlbum({
        title: 'Test',
        artist: 'Test',
        format: 'INVALID_FORMAT',
        speed: 'INVALID_SPEED',
        condition: 'INVALID_CONDITION'
      })
      
      const result = validateAlbum(album)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.isValid).toBe(false)
    })
  })

  describe('Constants', () => {
    it('has expected format options', () => {
      expect(ALBUM_FORMATS).toContain('LP')
      expect(ALBUM_FORMATS).toContain('EP')
      expect(ALBUM_FORMATS).toContain('Single')
    })

    it('has expected speed options', () => {
      expect(RECORD_SPEEDS).toContain('33⅓ RPM')
      expect(RECORD_SPEEDS).toContain('45 RPM')
      expect(RECORD_SPEEDS).toContain('78 RPM')
    })

    it('has expected condition options', () => {
      expect(CONDITION_GRADES).toContain('Mint (M)')
      expect(CONDITION_GRADES).toContain('Near Mint (NM)')
      expect(CONDITION_GRADES).toContain('Very Good Plus (VG+)')
    })

    it('has expected genre options', () => {
      expect(MUSIC_GENRES.length).toBeGreaterThan(10)
      expect(MUSIC_GENRES).toContain('Rock')
      expect(MUSIC_GENRES).toContain('Jazz')
      expect(MUSIC_GENRES).toContain('Classical')
    })
  })
})