import React, { useState, useEffect } from 'react';
import { History, Trash2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export default function HistoryView() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/history?limit=30');
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/history/${id}`);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
  };

  return (
    <div className="clinical-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Patient Screening Consultation History
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Locally stored consultation audit records in SQLite database (anonymized clinical logs).
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)', fontSize: '0.875rem' }}>
          Loading consultation history logs...
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)', fontSize: '0.875rem' }}>
          No screening logs recorded yet. Upload or capture an image on the workbench to create records.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map((record) => (
            <div
              key={record.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {record.image_preview && (
                  <img
                    src={record.image_preview}
                    alt="Preview"
                    style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border-strong)' }}
                  />
                )}
                <div>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {record.predicted_class}
                  </h4>
                  <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {new Date(record.created_at).toLocaleString()}
                    </span>
                    <span>• Latency: {record.processing_time_ms} ms</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge-pill ${record.is_uncertain ? 'badge-warning' : 'badge-success'}`}>
                  {record.is_uncertain ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {(record.confidence * 100).toFixed(1)}% Confidence
                </span>

                <button
                  onClick={() => handleDelete(record.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-light)',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 4
                  }}
                  title="Delete record"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
