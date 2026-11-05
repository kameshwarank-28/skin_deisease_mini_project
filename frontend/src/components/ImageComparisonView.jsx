import React, { useState, useEffect, useRef } from 'react';
import { GitCompare, Camera, AlertTriangle } from 'lucide-react';
import api, { getImageUrl } from '../services/api';

export default function ImageComparisonView({ preselectedRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection states
  const [earlierId, setEarlierId] = useState('');
  const [laterId, setLaterId] = useState('');
  const [filterLocation, setFilterLocation] = useState('All');

  // Comparison Results
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [viewMode, setViewMode] = useState('slider'); // 'slider' | 'side-by-side'

  // Interactive slider position (0 - 100%)
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/skin-records');
      const data = res.data || [];
      setRecords(data);

      if (data.length >= 2) {
        // Sort chronologically
        const sorted = [...data].sort((a, b) => new Date(a.capture_date) - new Date(b.capture_date));
        if (preselectedRecord) {
          const preId = preselectedRecord.id;
          const others = sorted.filter(r => r.id !== preId && r.body_location === preselectedRecord.body_location);
          if (others.length > 0) {
            setEarlierId(String(others[0].id));
            setLaterId(String(preId));
          } else {
            setEarlierId(String(sorted[0].id));
            setLaterId(String(sorted[sorted.length - 1].id));
          }
        } else {
          setEarlierId(String(sorted[0].id));
          setLaterId(String(sorted[sorted.length - 1].id));
        }
      } else if (data.length === 1) {
        setEarlierId(String(data[0].id));
      }
    } catch (err) {
      console.error('Failed loading records for comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunComparison = async () => {
    if (!earlierId || !laterId || earlierId === laterId) {
      alert('Please select two distinct skin records to compare.');
      return;
    }

    setComparing(true);
    try {
      const res = await api.post('/api/skin-comparison', {
        earlier_record_id: parseInt(earlierId),
        later_record_id: parseInt(laterId)
      });
      setComparisonResult(res.data);
    } catch (err) {
      alert('Comparison failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setComparing(false);
    }
  };

  // Slider Mouse/Touch drag handlers
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;
    const offsetX = clientX - rect.left;
    const newPos = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPos(newPos);
  };

  const earlierRecord = records.find(r => r.id === parseInt(earlierId));
  const laterRecord = records.find(r => r.id === parseInt(laterId));

  const uniqueLocations = Array.from(new Set(records.map(r => r.body_location)));

  return (
    <div>
      {/* Top Banner */}
      <div className="project-card">
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1177DE', margin: '0 0 4px' }}>
          Longitudinal Skin Photo Comparison
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: 0 }}>
          Compare skin lesion photos captured at different dates using an interactive before/after split slider and neutral computer-vision difference estimation.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="project-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr)) 140px', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Earlier Photo (Baseline):</label>
            <select
              value={earlierId}
              onChange={(e) => { setEarlierId(e.target.value); setComparisonResult(null); }}
              className="form-select"
            >
              <option value="">-- Select Earlier Photo --</option>
              {records.map(r => (
                <option key={r.id} value={r.id}>
                  #{r.id} {r.body_location} ({new Date(r.capture_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Later Photo (Follow-up):</label>
            <select
              value={laterId}
              onChange={(e) => { setLaterId(e.target.value); setComparisonResult(null); }}
              className="form-select"
            >
              <option value="">-- Select Later Photo --</option>
              {records.map(r => (
                <option key={r.id} value={r.id}>
                  #{r.id} {r.body_location} ({new Date(r.capture_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Location Filter:</label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="form-select"
            >
              <option value="All">All Sites</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunComparison}
            disabled={!earlierId || !laterId || earlierId === laterId || comparing}
            className="btn-submit"
            style={{ width: '100%', justifyContent: 'center', height: 38 }}
          >
            {comparing ? 'Analyzing...' : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <GitCompare size={15} />
                <span>Compare</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Comparison Workspace */}
      {earlierRecord && laterRecord ? (
        <div>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => setViewMode('slider')}
              className={viewMode === 'slider' ? 'btn-submit' : 'btn-outline'}
              style={{ padding: '6px 16px', fontSize: '0.85rem' }}
            >
              ↔ Split Slider View
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={viewMode === 'side-by-side' ? 'btn-submit' : 'btn-outline'}
              style={{ padding: '6px 16px', fontSize: '0.85rem' }}
            >
              ⊞ Side-by-Side View
            </button>
          </div>

          {/* View Container */}
          <div className="project-card" style={{ padding: 20 }}>
            {viewMode === 'slider' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: '#6c757d', marginBottom: 10 }}>
                  Drag the blue slider horizontally to wipe between the earlier photo and the follow-up photo.
                </p>

                <div
                  ref={containerRef}
                  className="comparison-container"
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  onTouchStart={handleMouseDown}
                  onTouchEnd={handleMouseUp}
                  onTouchMove={handleMouseMove}
                  style={{ height: 380, position: 'relative', cursor: isDragging ? 'ew-resize' : 'default' }}
                >
                  {/* Later Image (Bottom Layer) */}
                  <img
                    src={getImageUrl(laterRecord.image_url) || laterRecord.thumbnail_b64}
                    alt="Later"
                    onError={(e) => {
                      if (laterRecord.thumbnail_b64 && e.target.src !== laterRecord.thumbnail_b64) {
                        e.target.src = laterRecord.thumbnail_b64;
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0, backgroundColor: '#000' }}
                  />

                  {/* Earlier Image (Clipped Top Layer) */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden',
                    clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                  }}>
                    <img
                      src={getImageUrl(earlierRecord.image_url) || earlierRecord.thumbnail_b64}
                      alt="Earlier"
                      onError={(e) => {
                        if (earlierRecord.thumbnail_b64 && e.target.src !== earlierRecord.thumbnail_b64) {
                          e.target.src = earlierRecord.thumbnail_b64;
                        }
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                    />
                  </div>

                  {/* Slider Bar */}
                  <div
                    className="slider-handle"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="slider-button">
                      ↔
                    </div>
                  </div>

                  {/* Floating Date Labels */}
                  <div style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                    Earlier: {new Date(earlierRecord.capture_date).toLocaleDateString()}
                  </div>
                  <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                    Follow-up: {new Date(laterRecord.capture_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ) : (
              /* Side by Side Mode */
              <div className="grid-2">
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1177DE', marginBottom: 6 }}>
                    EARLIER PHOTO (BASELINE)
                  </div>
                  <div style={{ height: 260, backgroundColor: '#000', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                    <img
                      src={getImageUrl(earlierRecord.image_url) || earlierRecord.thumbnail_b64}
                      alt="Earlier"
                      onError={(e) => {
                        if (earlierRecord.thumbnail_b64 && e.target.src !== earlierRecord.thumbnail_b64) {
                          e.target.src = earlierRecord.thumbnail_b64;
                        }
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#495057' }}>
                    <strong>Captured:</strong> {new Date(earlierRecord.capture_date).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    <strong>Location:</strong> {earlierRecord.body_location}
                  </div>
                  {earlierRecord.user_notes && (
                    <p style={{ fontSize: '0.75rem', color: '#6c757d', margin: '4px 0 0' }}>
                      "{earlierRecord.user_notes}"
                    </p>
                  )}
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#198754', marginBottom: 6 }}>
                    FOLLOW-UP PHOTO (NEWER)
                  </div>
                  <div style={{ height: 260, backgroundColor: '#000', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                    <img
                      src={getImageUrl(laterRecord.image_url) || laterRecord.thumbnail_b64}
                      alt="Later"
                      onError={(e) => {
                        if (laterRecord.thumbnail_b64 && e.target.src !== laterRecord.thumbnail_b64) {
                          e.target.src = laterRecord.thumbnail_b64;
                        }
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#495057' }}>
                    <strong>Captured:</strong> {new Date(laterRecord.capture_date).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    <strong>Location:</strong> {laterRecord.body_location}
                  </div>
                  {laterRecord.user_notes && (
                    <p style={{ fontSize: '0.75rem', color: '#6c757d', margin: '4px 0 0' }}>
                      "{laterRecord.user_notes}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: OBSERVED VISUAL CHANGES */}
          <div className="project-card">
            <div className="project-card-header" style={{ color: '#1177DE' }}>
              OBSERVED VISUAL CHANGES
            </div>

            {comparisonResult ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
                  <div style={{ backgroundColor: '#f8f9fa', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>Image Similarity Index</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1177DE' }}>
                      {(comparisonResult.similarity_score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8f9fa', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>Color Shift Flag</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: comparisonResult.color_shift_detected ? '#dc3545' : '#198754' }}>
                      {comparisonResult.color_shift_detected ? 'Color Shift Present' : 'Consistent Lighting'}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f8f9fa', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>Elapsed Monitoring Period</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#212529' }}>
                      {Math.max(1, Math.round(Math.abs(new Date(laterRecord.capture_date) - new Date(earlierRecord.capture_date)) / (1000 * 60 * 60 * 24)))} Days
                    </div>
                  </div>
                </div>

                {/* Specific Observations List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {comparisonResult.observed_changes.map((obs, idx) => (
                    <div key={idx} style={{ backgroundColor: '#f8f9fa', borderLeft: '4px solid #1177DE', padding: '10px 14px', borderRadius: 4 }}>
                      <strong style={{ fontSize: '0.85rem', color: '#212529' }}>{obs.observation_type}:</strong>
                      <p style={{ margin: '2px 0 4px', fontSize: '0.85rem', color: '#495057' }}>
                        {obs.summary}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                        Analytical Metric: {obs.neutral_metric}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>
                <p style={{ fontSize: '0.875rem' }}>
                  Click <strong>"Compare"</strong> above to calculate OpenCV histogram and erythema metrics.
                </p>
              </div>
            )}

            {/* Influencing factors explanation & Mandatory Medical Disclaimer */}
            <div style={{ marginTop: 14, padding: 14, backgroundColor: '#fff3cd', border: '1px solid #ffecb5', borderRadius: 6, fontSize: '0.8rem', color: '#664d03', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} color="#d97706" />
                <span>Important Clinical Factors Influencing Photo Comparisons:</span>
              </div>
              <ul style={{ paddingLeft: 18, marginBottom: 8 }}>
                <li><strong>Lighting conditions:</strong> Direct sunlight, fluorescent, or flash lighting substantially alters perceived redness and color warmth.</li>
                <li><strong>Distance & camera angle:</strong> Macro distance variations alter lesion perimeter perception and surface texture.</li>
                <li><strong>Camera sensor & white balance:</strong> Mobile phone cameras apply automatic color grading and tone compression.</li>
                <li><strong>Skin position & hydration:</strong> Flexion, tension, and topical moisturizer applications create specular highlights.</li>
              </ul>
              <div>
                <strong>Notice:</strong> Observed image variations represent mathematical metrics only and must <strong>NEVER</strong> be interpreted as evidence of treatment success, treatment failure, or disease remission. Always consult your treating dermatologist for physical clinical examination.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="project-card" style={{ textAlign: 'center', padding: 50, color: '#6c757d' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Camera size={44} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: '1.1rem', color: '#495057' }}>Insufficient Records to Compare</h3>
          <p style={{ fontSize: '0.85rem', maxWidth: 450, margin: '0 auto 16px' }}>
            You need at least two skin health records saved to perform longitudinal comparison. Capture or upload lesion photos over time to track changes.
          </p>
        </div>
      )}
    </div>
  );
}

