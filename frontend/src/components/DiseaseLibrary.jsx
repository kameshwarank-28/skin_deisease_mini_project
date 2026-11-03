import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, Sparkles, Filter, CheckCircle2, ChevronRight, BookOpen, AlertOctagon } from 'lucide-react';
import axios from 'axios';

export default function DiseaseLibrary() {
  const [diseases, setDiseases] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiseases();
  }, []);

  const fetchDiseases = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/diseases');
      setDiseases(res.data);
      const keys = Object.keys(res.data);
      if (keys.length > 0) {
        setSelectedDisease(keys[0]);
      }
    } catch (err) {
      console.error('Failed to fetch diseases:', err);
    } finally {
      setLoading(false);
    }
  };

  const diseaseEntries = Object.entries(diseases);
  const filtered = diseaseEntries.filter(([key, d]) => {
    const q = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.scientific_name && d.scientific_name.toLowerCase().includes(q)) ||
      (d.description && d.description.toLowerCase().includes(q))
    );
  });

  const activeData = selectedDisease ? diseases[selectedDisease] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Search */}
      <div className="clinical-card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Dermatological Reference Encyclopedia
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Clinical descriptions, differential characteristics, and management guidelines for all 10 model classes.
          </p>
        </div>

        <div style={{ position: 'relative', minWidth: 280 }}>
          <Search size={16} color="var(--text-light)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search conditions, symptoms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px 8px 36px',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 2-Column Encyclopedia View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: 24 }}>
        {/* List of Diseases */}
        <div className="clinical-card" style={{ padding: 12, maxHeight: 620, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(([key, item]) => {
            const isSelected = selectedDisease === key;
            const isHigh = item.risk_level?.toLowerCase().includes('high');
            return (
              <div
                key={key}
                onClick={() => setSelectedDisease(key)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--primary-light)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--primary-blue)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary-blue)' : 'var(--text-main)' }}>
                    {item.name}
                  </h4>
                  <span style={{ fontSize: '0.725rem', color: isHigh ? 'var(--danger-color)' : 'var(--text-light)' }}>
                    {item.risk_level}
                  </span>
                </div>
                <ChevronRight size={15} color={isSelected ? 'var(--primary-blue)' : 'var(--text-light)'} />
              </div>
            );
          })}
        </div>

        {/* Selected Disease Details */}
        {activeData && (
          <div className="clinical-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeData.name}</h3>
                  <p style={{ color: 'var(--primary-blue)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: 1 }}>
                    {activeData.scientific_name}
                  </p>
                </div>
                <span className={`badge-pill ${activeData.risk_level?.toLowerCase().includes('high') ? 'badge-danger' : 'badge-primary'}`}>
                  {activeData.risk_level}
                </span>
              </div>
              <p style={{ marginTop: 14, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {activeData.description}
              </p>
            </div>

            {/* Symptoms */}
            {activeData.symptoms && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
                  Pathological Signs & Clinical Presentation
                </h4>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {activeData.symptoms.map((s, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Care & Management */}
            {activeData.care_tips && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
                  Standard Clinical Management & Self-Care
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {activeData.care_tips.map((tip, i) => (
                    <div key={i} style={{
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-subtle)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      • {tip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referral / Warning */}
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-color)',
              padding: 14,
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              color: 'var(--danger-color)'
            }}>
              <strong>Clinical Action Threshold:</strong> {activeData.when_to_see_doctor}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
