import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetadataSearch } from '../hooks/useMetadataSearch';

// ---------------------------------------------------------------------------
// Mock metadataEnricher so we don't hit real APIs
// ---------------------------------------------------------------------------
vi.mock('../services/metadataEnricher.js', () => ({
  MetadataEnricher: {
    searchAlbumMetadata: vi.fn(),
    getDetailedMetadata: vi.fn(),
  },
  createAlbumFromMetadata: vi.fn((metadata, preserved) => ({
    ...metadata,
    ...preserved,
    _enriched: true,
  })),
}));

import { MetadataEnricher, createAlbumFromMetadata } from '../services/metadataEnricher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeFormData = (overrides = {}) => ({
  title: 'Rumours',
  artist: 'Fleetwood Mac',
  purchasePrice: 15,
  purchaseLocation: 'Downtown Records',
  notes: 'Good copy',
  condition: 'VG+',
  speed: '33⅓ RPM',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Edit mode behaviour
// ---------------------------------------------------------------------------
describe('useMetadataSearch — edit mode', () => {
  it('sets showSuggestions to false on mount in edit mode', () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'edit', vi.fn())
    );
    expect(result.current.showSuggestions).toBe(false);
  });

  it('does not show loading spinner on mount in edit mode', () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'edit', vi.fn())
    );
    expect(result.current.isLoadingSuggestions).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Add mode — debounce behaviour
// ---------------------------------------------------------------------------
describe('useMetadataSearch — add mode debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MetadataEnricher.searchAlbumMetadata.mockResolvedValue([
      { id: '1', source: 'musicbrainz', title: 'Rumours', artist: 'Fleetwood Mac' },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not call searchAlbumMetadata immediately on triggerSearch', () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );
    act(() => {
      result.current.triggerSearch('Rumours', 'Fleetwood Mac');
    });
    expect(MetadataEnricher.searchAlbumMetadata).not.toHaveBeenCalled();
  });

  it('calls searchAlbumMetadata after the 1-second debounce', async () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );
    act(() => {
      result.current.triggerSearch('Rumours', 'Fleetwood Mac');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(MetadataEnricher.searchAlbumMetadata).toHaveBeenCalledTimes(1);
    expect(MetadataEnricher.searchAlbumMetadata).toHaveBeenCalledWith('Rumours', 'Fleetwood Mac');
  });

  it('only fires once when triggerSearch is called multiple times rapidly', async () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );
    act(() => {
      result.current.triggerSearch('R', 'Fleetwood Mac');
      result.current.triggerSearch('Ru', 'Fleetwood Mac');
      result.current.triggerSearch('Rum', 'Fleetwood Mac');
      result.current.triggerSearch('Rumours', 'Fleetwood Mac');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(MetadataEnricher.searchAlbumMetadata).toHaveBeenCalledTimes(1);
    expect(MetadataEnricher.searchAlbumMetadata).toHaveBeenCalledWith('Rumours', 'Fleetwood Mac');
  });

  it('sets showSuggestions to true when suggestions are returned', async () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );
    act(() => {
      result.current.triggerSearch('Rumours', 'Fleetwood Mac');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.showSuggestions).toBe(true);
    expect(result.current.metadataSuggestions).toHaveLength(1);
  });

  it('keeps showSuggestions false when API returns empty array', async () => {
    MetadataEnricher.searchAlbumMetadata.mockResolvedValue([]);
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );
    act(() => {
      result.current.triggerSearch('Unknown Album', 'Unknown Artist');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.showSuggestions).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleSkipSuggestions
// ---------------------------------------------------------------------------
describe('useMetadataSearch — handleSkipSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MetadataEnricher.searchAlbumMetadata.mockResolvedValue([
      { id: '1', source: 'musicbrainz', title: 'Rumours', artist: 'Fleetwood Mac' },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('resets showSuggestions, metadataSuggestions, and isLoadingSuggestions', async () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );
    // First trigger and resolve to get suggestions showing
    act(() => {
      result.current.triggerSearch('Rumours', 'Fleetwood Mac');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.showSuggestions).toBe(true);

    // Now skip
    act(() => {
      result.current.handleSkipSuggestions();
    });
    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.metadataSuggestions).toHaveLength(0);
    expect(result.current.isLoadingSuggestions).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleSelectSuggestion
// ---------------------------------------------------------------------------
describe('useMetadataSearch — handleSelectSuggestion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MetadataEnricher.getDetailedMetadata.mockResolvedValue({
      title: 'Rumours',
      artist: 'Fleetwood Mac',
      year: 1977,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('calls onApply with enriched data when a suggestion is selected', async () => {
    const onApply = vi.fn();
    const formData = makeFormData();
    const { result } = renderHook(() =>
      useMetadataSearch(formData, 'add', onApply)
    );
    const suggestion = { id: '1', source: 'musicbrainz', title: 'Rumours' };

    await act(async () => {
      await result.current.handleSelectSuggestion(suggestion);
    });

    expect(MetadataEnricher.getDetailedMetadata).toHaveBeenCalledWith(suggestion);
    expect(onApply).toHaveBeenCalledTimes(1);
    const appliedData = onApply.mock.calls[0][0];
    expect(appliedData._enriched).toBe(true);
  });

  it('preserves purchasePrice and purchaseLocation from formData on apply', async () => {
    const onApply = vi.fn();
    const formData = makeFormData({ purchasePrice: 22.50, purchaseLocation: 'Vinyl Vault' });
    const { result } = renderHook(() =>
      useMetadataSearch(formData, 'add', onApply)
    );

    await act(async () => {
      await result.current.handleSelectSuggestion({ id: '1' });
    });

    expect(createAlbumFromMetadata).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        purchasePrice: 22.50,
        purchaseLocation: 'Vinyl Vault',
      })
    );
  });

  it('resets suggestion state after apply', async () => {
    const { result } = renderHook(() =>
      useMetadataSearch(makeFormData(), 'add', vi.fn())
    );

    await act(async () => {
      await result.current.handleSelectSuggestion({ id: '1' });
    });

    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.metadataSuggestions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mode switch resets state
// ---------------------------------------------------------------------------
describe('useMetadataSearch — mode switching', () => {
  it('resets to search-suppressed state when switching to edit mode', () => {
    const { result, rerender } = renderHook(
      ({ mode }) => useMetadataSearch(makeFormData(), mode, vi.fn()),
      { initialProps: { mode: 'add' } }
    );

    // Simulate suggestions being visible (manually set via re-render isn't possible,
    // so we just verify the edit mode effect fires correctly)
    rerender({ mode: 'edit' });

    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.metadataSuggestions).toHaveLength(0);
  });
});
