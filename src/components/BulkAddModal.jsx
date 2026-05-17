import React, { useState, useRef } from 'react';
import { createNewAlbum } from '../models/Album';

// --- Parsing ---

/**
 * Parse raw text input into a list of query strings.
 * Supports newline-separated and comma-separated entries.
 * Blank lines / empty entries are ignored.
 */
function parseInputToQueries(raw) {
  // Split on newlines first, then on commas within each line
  const lines = raw.split('\n');
  const queries = [];

  for (const line of lines) {
    // If the line itself looks like "Artist - Title" treat the whole line as one query
    // Otherwise split by comma to allow "Album A, Album B" on one line
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heuristic: if the line contains " - " it's probably "Artist - Title", don't comma-split it
    if (trimmed.includes(' - ')) {
      queries.push(trimmed);
    } else {
      const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      queries.push(...parts);
    }
  }

  return queries;
}

// --- Search ---

async function searchDiscogs(query) {
  const { DiscogsClient } = await import('../services/api/music/index.js');
  const results = await DiscogsClient.searchReleases(query.trim());
  return results || [];
}

// Simple similarity score: how many words from the query appear in the result title+artist
function scoreSimilarity(query, result) {
  const haystack = `${result.title || ''} ${result.artist || ''}`.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 0;
  const matches = words.filter(w => haystack.includes(w)).length;
  return matches / words.length;
}

// --- Status badge ---

const STATUS_COLORS = {
  pending:  'bg-gray-700 text-gray-300',
  loading:  'bg-blue-900 text-blue-300',
  matched:  'bg-green-900 text-green-300',
  uncertain:'bg-yellow-900 text-yellow-300',
  unmatched:'bg-red-900 text-red-300',
  skipped:  'bg-gray-800 text-gray-500',
};

const STATUS_LABELS = {
  pending:   'Pending',
  loading:   'Searching…',
  matched:   'Matched',
  uncertain: 'Review',
  unmatched: 'No match',
  skipped:   'Skipped',
};

// --- BulkAddModal ---

const STEP_INPUT   = 'input';
const STEP_MATCH   = 'match';
const STEP_DONE    = 'done';

/**
 * Build a normalised key for duplicate detection: "artist|title" lowercase, trimmed.
 */
function dupKey(artist, title) {
  return `${(artist || '').toLowerCase().trim()}|${(title || '').toLowerCase().trim()}`;
}

const BulkAddModal = ({ onClose, onSaveAlbums, onGoToCollection, existingAlbums = [] }) => {
  // Build a Set of existing album keys once — stable across re-renders for this modal session
  const existingKeys = React.useMemo(
    () => new Set(existingAlbums.map(a => dupKey(a.artist, a.title))),
    [existingAlbums]
  );
  const [step, setStep]           = useState(STEP_INPUT);
  const [rawText, setRawText]     = useState('');
  const [items, setItems]         = useState([]);  // array of item objects (see below)
  const [saving, setSaving]       = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // For the "pick alternative" popover
  const [expandedIdx, setExpandedIdx] = useState(null);

  const textareaRef = useRef(null);

  // ── item shape ──────────────────────────────────────────────────────────────
  // {
  //   id: number,
  //   query: string,           // original text the user typed
  //   status: pending|loading|matched|uncertain|unmatched|skipped
  //   results: [],             // raw Discogs results
  //   selectedResult: null,    // the result the user picked (or best auto-pick)
  //   included: bool,          // checkbox
  // }

  // ── Step 1: parse input and kick off matching ────────────────────────────

  const handleStartMatching = async () => {
    const queries = parseInputToQueries(rawText);
    if (queries.length === 0) return;

    const initialItems = queries.map((q, i) => ({
      id: i,
      query: q,
      status: 'pending',
      results: [],
      selectedResult: null,
      included: true,
    }));

    setItems(initialItems);
    setStep(STEP_MATCH);

    // Search sequentially to respect Discogs rate limit (~1 req/sec)
    for (let i = 0; i < initialItems.length; i++) {
      // Mark as loading
      setItems(prev => prev.map(it => it.id === i ? { ...it, status: 'loading' } : it));

      try {
        const results = await searchDiscogs(initialItems[i].query);

        let selectedResult = null;
        let status = 'unmatched';

        if (results.length > 0) {
          const best = results[0];
          const score = scoreSimilarity(initialItems[i].query, best);

          if (score >= 0.6) {
            selectedResult = best;
            status = 'matched';
          } else if (score >= 0.3) {
            selectedResult = best;
            status = 'uncertain';
          } else {
            // Results exist but confidence is low — still surface the best one as uncertain
            selectedResult = results[0];
            status = 'uncertain';
          }
        }

        const isDuplicate = selectedResult
          ? existingKeys.has(dupKey(selectedResult.artist, selectedResult.title))
          : false;

        setItems(prev => prev.map(it =>
          it.id === i
            ? { ...it, status, results, selectedResult, isDuplicate, included: isDuplicate ? false : it.included }
            : it
        ));
      } catch {
        setItems(prev => prev.map(it =>
          it.id === i ? { ...it, status: 'unmatched', results: [] } : it
        ));
      }

      // Pace at ~1.1 s between requests (Discogs limit)
      if (i < initialItems.length - 1) {
        await new Promise(res => setTimeout(res, 1100));
      }
    }
  };

  // ── Checkbox toggle ────────────────────────────────────────────────────────

  const toggleIncluded = (id) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, included: !it.included } : it));
  };

  // ── Alternative picker ─────────────────────────────────────────────────────

  const pickAlternative = (itemId, result) => {
    const isDuplicate = existingKeys.has(dupKey(result.artist, result.title));
    setItems(prev => prev.map(it =>
      it.id === itemId
        ? { ...it, selectedResult: result, status: 'matched', isDuplicate, included: !isDuplicate }
        : it
    ));
    setExpandedIdx(null);
  };

  // ── Step 3: Save ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    const toSave = items.filter(it => it.included && it.selectedResult);
    if (toSave.length === 0) return;

    setSaving(true);
    let count = 0;

    for (const item of toSave) {
      const r = item.selectedResult;
      const album = createNewAlbum({
        title:              r.title,
        artist:             r.artist,
        year:               r.year,
        format:             r.format || 'LP',
        genre:              r.genre || [],
        label:              r.label || '',
        catalogNumber:      r.catalogNumber || '',
        coverImage:         r.coverImage || r.thumb || null,
        identificationMethod: 'discogs-search',
        metadata: {
          discogsId: r.id || r.discogsId,
        },
      });

      try {
        await onSaveAlbums(album);
        count++;
      } catch (err) {
        console.error('Failed to save album:', r.title, err);
      }
    }

    setSavedCount(count);
    setSaving(false);
    setStep(STEP_DONE);
  };

  // ── helpers ────────────────────────────────────────────────────────────────

  const includedWithMatch = items.filter(it => it.included && it.selectedResult).length;
  const searchDone = items.length > 0 && items.every(it => it.status !== 'pending' && it.status !== 'loading');
  const stillSearching = items.some(it => it.status === 'loading' || it.status === 'pending');

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-start justify-center"
      style={{ touchAction: 'none' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 mt-8 mb-8 flex flex-col"
        style={{ maxHeight: 'calc(100vh - 4rem)', touchAction: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Add Multiple Albums</h2>
            {step === STEP_INPUT && (
              <p className="text-sm text-gray-400 mt-0.5">Enter album names to search and add in bulk</p>
            )}
            {step === STEP_MATCH && (
              <p className="text-sm text-gray-400 mt-0.5">
                {stillSearching
                  ? `Searching… (${items.filter(it => it.status !== 'pending' && it.status !== 'loading').length} / ${items.length})`
                  : `Found matches for ${items.length} entr${items.length === 1 ? 'y' : 'ies'}`}
              </p>
            )}
            {step === STEP_DONE && (
              <p className="text-sm text-green-400 mt-0.5">Done — {savedCount} album{savedCount !== 1 ? 's' : ''} added</p>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mr-4">
            {[STEP_INPUT, STEP_MATCH, STEP_DONE].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === s ? 'bg-purple-600 text-white' :
                    [STEP_INPUT, STEP_MATCH, STEP_DONE].indexOf(step) > i ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-500'}`}>
                  {i + 1}
                </div>
                {i < 2 && <div className="w-4 h-px bg-gray-700" />}
              </React.Fragment>
            ))}
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-white flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">

          {/* ─ Step 1: Input ─ */}
          {step === STEP_INPUT && (
            <div className="space-y-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm text-gray-400 space-y-1">
                <p>Enter one album per line, or separate with commas.</p>
                <p>You can use <span className="text-gray-200">Artist - Title</span> or just the album name.</p>
              </div>

              <textarea
                ref={textareaRef}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Pink Floyd - Dark Side of the Moon\nRumours\nKind of Blue, Abbey Road\nThe Velvet Underground & Nico`}
                className="w-full h-56 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500 text-sm"
                autoFocus
              />

              <p className="text-xs text-gray-500">
                {parseInputToQueries(rawText).length} album{parseInputToQueries(rawText).length !== 1 ? 's' : ''} detected
              </p>
            </div>
          )}

          {/* ─ Step 2: Match results ─ */}
          {step === STEP_MATCH && (
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className={`border rounded-lg overflow-hidden transition-colors
                    ${item.included ? 'border-gray-600 bg-gray-800' : 'border-gray-800 bg-gray-900 opacity-60'}`}
                >
                  <div className="flex items-start gap-3 p-3">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => toggleIncluded(item.id)}
                        disabled={!item.selectedResult}
                        className="w-4 h-4 accent-purple-500 cursor-pointer"
                      />
                    </div>

                    {/* Query label */}
                    <div className="flex-shrink-0 w-36 pt-1">
                      <span className="text-gray-400 text-xs line-clamp-2 leading-tight">{item.query}</span>
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0 text-gray-600 pt-1">→</div>

                    {/* Match content */}
                    <div className="flex-1 min-w-0">
                      {item.status === 'loading' && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          <span>Searching Discogs…</span>
                        </div>
                      )}

                      {item.status === 'pending' && (
                        <span className="text-gray-600 text-sm">Waiting…</span>
                      )}

                      {item.status === 'unmatched' && (
                        <span className="text-red-400 text-sm">No match found</span>
                      )}

                      {(item.status === 'matched' || item.status === 'uncertain') && item.selectedResult && (
                        <div className="flex items-center gap-3">
                          {/* Cover thumbnail */}
                          {(item.selectedResult.coverImage || item.selectedResult.thumb) ? (
                            <img
                              src={item.selectedResult.coverImage || item.selectedResult.thumb}
                              alt={item.selectedResult.title}
                              className="w-12 h-12 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center text-gray-600">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.selectedResult.title}</p>
                            <p className="text-gray-400 text-xs truncate">{item.selectedResult.artist}</p>
                            <p className="text-gray-500 text-xs">
                              {[item.selectedResult.year, item.selectedResult.label].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side: status + change button */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-2 pt-0.5">
                      {/* Status badge */}
                      {item.status !== 'pending' && item.status !== 'loading' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      )}

                      {/* Duplicate warning */}
                      {item.isDuplicate && item.status !== 'pending' && item.status !== 'loading' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-900 text-orange-300" title="Already in your collection">
                          Already owned
                        </span>
                      )}

                      {/* Change button (only when results exist) */}
                      {item.results.length > 0 && item.status !== 'loading' && item.status !== 'pending' && (
                        <button
                          onClick={() => setExpandedIdx(expandedIdx === item.id ? null : item.id)}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          {expandedIdx === item.id ? 'Close' : 'Change'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alternative results dropdown */}
                  {expandedIdx === item.id && item.results.length > 0 && (
                    <div className="border-t border-gray-700 bg-gray-850 divide-y divide-gray-700">
                      <p className="text-xs text-gray-500 px-4 py-2">Pick a different match:</p>
                      {item.results.slice(0, 8).map((r, ri) => (
                        <button
                          key={ri}
                          onClick={() => pickAlternative(item.id, r)}
                          className={`w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-gray-700 transition-colors
                            ${item.selectedResult === r ? 'bg-gray-700' : ''}`}
                        >
                          {(r.coverImage || r.thumb) ? (
                            <img src={r.coverImage || r.thumb} alt={r.title} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-700 rounded flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{r.title}</p>
                            <p className="text-gray-400 text-xs truncate">{r.artist}</p>
                            <p className="text-gray-500 text-xs">{[r.year, r.label, r.format].filter(Boolean).join(' · ')}</p>
                          </div>
                          {item.selectedResult === r && (
                            <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─ Step 3: Done ─ */}
          {step === STEP_DONE && (
            <div className="text-center py-10 space-y-4">
              <div className="text-6xl">🎉</div>
              <h3 className="text-xl font-bold text-white">{savedCount} album{savedCount !== 1 ? 's' : ''} added!</h3>
              {items.filter(it => !it.selectedResult || !it.included).length > 0 && (
                <p className="text-gray-400 text-sm">
                  {items.filter(it => !it.selectedResult).length} item{items.filter(it => !it.selectedResult).length !== 1 ? 's' : ''} had no match and were skipped.
                </p>
              )}
              <button
                onClick={() => { onClose(); if (onGoToCollection) onGoToCollection(); }}
                className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                View Collection
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step !== STEP_DONE && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {step === STEP_MATCH && searchDone && (
                <div className="text-right">
                  <span className="text-sm text-gray-500">
                    {includedWithMatch} album{includedWithMatch !== 1 ? 's' : ''} ready to add
                  </span>
                  {items.filter(it => it.isDuplicate).length > 0 && (
                    <p className="text-xs text-orange-400 mt-0.5">
                      {items.filter(it => it.isDuplicate).length} already in collection — unchecked
                    </p>
                  )}
                </div>
              )}

              {step === STEP_INPUT && (
                <button
                  onClick={handleStartMatching}
                  disabled={parseInputToQueries(rawText).length === 0}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
                >
                  Search {parseInputToQueries(rawText).length > 0 ? `${parseInputToQueries(rawText).length} album${parseInputToQueries(rawText).length !== 1 ? 's' : ''}` : ''}
                </button>
              )}

              {step === STEP_MATCH && (
                <button
                  onClick={handleSave}
                  disabled={saving || includedWithMatch === 0 || stillSearching}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Saving…' : `Add ${includedWithMatch} Album${includedWithMatch !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkAddModal;
