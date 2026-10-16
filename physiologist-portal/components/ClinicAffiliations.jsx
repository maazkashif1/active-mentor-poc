'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { logoUrl } from '../lib/hospitals';

/**
 * Curated hospital chips + Places (or curated) search for affiliations.
 */
export default function ClinicAffiliations({ clinics, onChange }) {
  const [catalog, setCatalog] = useState([]);
  const [placesEnabled, setPlacesEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/places/hospitals')
      .then(d => {
        setCatalog(d.hospitals || []);
        setPlacesEnabled(!!d.placesEnabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const d = await api.get(`/api/places/autocomplete?q=${encodeURIComponent(query.trim())}`);
        setSuggestions(d.suggestions || []);
        setPlacesEnabled(!!d.placesEnabled);
      } catch (e) {
        setError(e.message);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const selectedKeys = new Set(
    (clinics || []).map(c => c.logoKey || c.hospitalId || c.placeId).filter(Boolean),
  );

  const upsertClinic = (clinic) => {
    const key = clinic.logoKey || clinic.placeId || clinic.name;
    const exists = (clinics || []).some(
      c => (c.logoKey && c.logoKey === clinic.logoKey) ||
        (c.placeId && c.placeId === clinic.placeId) ||
        (c.name && c.name === clinic.name && c.branch === clinic.branch),
    );
    if (exists) return;
    onChange([...(clinics || []).filter(c => c.name || c.branch), clinic]);
  };

  const toggleCurated = (h) => {
    const already = (clinics || []).some(c => c.logoKey === h.logoKey || c.hospitalId === h.id);
    if (already) {
      onChange((clinics || []).filter(c => c.logoKey !== h.logoKey && c.hospitalId !== h.id));
      return;
    }
    upsertClinic({
      name: h.name,
      branch: h.branch,
      address: h.address,
      city: h.city,
      logoKey: h.logoKey,
      hospitalId: h.id,
      placeId: '',
      source: 'curated',
      lat: null,
      lng: null,
    });
  };

  const pickSuggestion = async (s) => {
    setQuery('');
    setSuggestions([]);
    if (s.source === 'curated' || s.hospitalId) {
      const h = catalog.find(x => x.id === s.hospitalId) || s;
      upsertClinic({
        name: h.name || s.name,
        branch: h.branch || s.branch || '',
        address: h.address || s.address || '',
        city: h.city || s.city || '',
        logoKey: h.logoKey || s.logoKey || '',
        hospitalId: h.id || s.hospitalId || '',
        placeId: '',
        source: 'curated',
        lat: null,
        lng: null,
      });
      return;
    }
    if (!s.placeId) {
      upsertClinic({
        name: s.name,
        branch: s.branch || '',
        address: s.address || '',
        city: s.city || '',
        logoKey: '',
        placeId: '',
        source: 'manual',
        lat: null,
        lng: null,
      });
      return;
    }
    try {
      const d = await api.get(`/api/places/details?placeId=${encodeURIComponent(s.placeId)}`);
      upsertClinic(d.clinic);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeAt = (i) => onChange((clinics || []).filter((_, idx) => idx !== i));

  const patchAt = (i, k, v) =>
    onChange((clinics || []).map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <p className="form-hint" style={{ margin: '0 0 10px' }}>
          Tap a hospital to affiliate. Search below for anywhere else
          {placesEnabled ? ' (Google Places).' : ' (curated search — add GOOGLE_PLACES_API_KEY for full Places).'}
        </p>
        <div className="chip-row" role="group" aria-label="Curated hospitals">
          {catalog.map(h => {
            const on = selectedKeys.has(h.logoKey) || selectedKeys.has(h.id);
            const src = logoUrl(h.logoKey);
            return (
              <button
                key={h.id}
                type="button"
                className="chip-pick"
                aria-pressed={on}
                onClick={() => toggleCurated(h)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 280 }}
              >
                {src ? (
                  <img src={src} alt="" style={{ height: 22, width: 'auto', maxWidth: 72, objectFit: 'contain' }} />
                ) : null}
                <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <strong style={{ display: 'block', fontSize: 12 }}>{h.name}</strong>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>{h.city}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="form-label" htmlFor="clinic-search">Search hospital or clinic</label>
        <input
          id="clinic-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Liaquat National, SIUT, private clinic…"
          className="form-field"
          autoComplete="off"
        />
        {searching ? <p className="form-hint">Searching…</p> : null}
        {suggestions.length > 0 ? (
          <ul className="stack" style={{ marginTop: 8, gap: 4, listStyle: 'none', padding: 0 }}>
            {suggestions.map((s, i) => (
              <li key={`${s.placeId || s.hospitalId || s.name}-${i}`}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => pickSuggestion(s)}
                >
                  <span>
                    <strong>{s.name}</strong>
                    {s.branch || s.address ? (
                      <span className="form-hint" style={{ display: 'block', margin: 0 }}>
                        {s.branch || s.address}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <h3 className="card-title" style={{ fontSize: 14, margin: 0 }}>Your affiliations</h3>
        {(clinics || []).filter(c => c.name || c.branch).length === 0 ? (
          <p className="form-hint" style={{ margin: 0 }}>None selected yet.</p>
        ) : (
          (clinics || []).map((c, i) => {
            if (!c.name && !c.branch) return null;
            const src = logoUrl(c.logoKey);
            return (
              <div key={i} className="edu-card">
                <button type="button" className="edu-remove" onClick={() => removeAt(i)} aria-label={`Remove ${c.name}`}>
                  ×
                </button>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt=""
                      style={{ height: 56, width: 88, objectFit: 'cover', borderRadius: 8, background: '#111' }}
                    />
                  ) : src ? (
                    <img src={src} alt="" style={{ height: 36, width: 110, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4 }} />
                  ) : (
                    <div style={{
                      height: 36, minWidth: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, opacity: 0.5,
                    }}>
                      Hx
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{c.name}</p>
                    <p className="form-hint" style={{ margin: 0 }}>
                      {[c.branch, c.city || c.address].filter(Boolean).join(' · ')}
                      {c.source === 'places' ? ' · Places' : c.source === 'curated' ? ' · Curated' : ''}
                      {c.photoUrl ? ' · Photo' : ''}
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="form-label">Branch / campus</label>
                    <input
                      type="text"
                      value={c.branch || ''}
                      onChange={e => patchAt(i, 'branch', e.target.value)}
                      className="form-field"
                      placeholder="Campus / wing"
                    />
                  </div>
                  <div>
                    <label className="form-label">City / address</label>
                    <input
                      type="text"
                      value={c.address || c.city || ''}
                      onChange={e => patchAt(i, 'address', e.target.value)}
                      className="form-field"
                      placeholder="City"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error ? <p className="form-hint" style={{ color: '#f87171' }}>{error}</p> : null}
    </div>
  );
}
