import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, CheckCircle2, AlertTriangle, RefreshCw, X, FileText } from 'lucide-react';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB configurable limit

export default function UploadSection({
  onFileSelected,
  onFileRemoved,
  selectedFile,
  previewUrl,
  loading,
  fileInputRef
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const validateAndProcessFile = (file) => {
    setValidationError(null);
    if (!file) return;

    // 1. Validate file extension
    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : '';
    const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
    const isTypeValid = ALLOWED_TYPES.includes(file.type) || file.type.startsWith('image/');

    if (!isExtensionValid && !isTypeValid) {
      setValidationError('Unsupported format. Please select a valid JPEG, JPG, PNG, or WEBP image.');
      return;
    }

    // 2. Validate file size (10MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setValidationError(`Image is too large (${sizeMB} MB). Maximum allowed size is 10 MB.`);
      return;
    }

    if (file.size === 0) {
      setValidationError('Selected file is empty. Please select a valid image.');
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Hidden file input controlled via fileInputRef */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
      />

      {/* Upload & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!loading && fileInputRef?.current) {
            fileInputRef.current.click();
          }
        }}
        style={{
          border: `2px dashed ${isDragging ? '#0d6efd' : '#cbd5e1'}`,
          background: isDragging ? '#eff6ff' : (previewUrl ? '#ffffff' : '#f8fafc'),
          borderRadius: 8,
          padding: previewUrl ? '16px' : '30px 20px',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minHeight: 210
        }}
      >
        {previewUrl ? (
          <div style={{ position: 'relative', width: '100%', maxWidth: 280, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <img
              src={previewUrl}
              alt="Selected skin lesion preview"
              style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200, objectFit: 'contain', backgroundColor: '#f1f5f9' }}
            />
            <div style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: '0.725rem',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <RefreshCw size={11} /> Click to change
            </div>
          </div>
        ) : (
          <>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7'
            }}>
              <UploadCloud size={26} />
            </div>

            <div>
              <p style={{ fontWeight: 700, fontSize: '0.925rem', color: '#0f172a', marginBottom: 2 }}>
                Click to browse or drag & drop lesion photo here
              </p>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Select a skin image from your computer or dermatoscope
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, fontSize: '0.725rem', color: '#94a3b8' }}>
              <span>• JPEG, JPG, PNG, WEBP</span>
              <span>• Max 10 MB</span>
            </div>
          </>
        )}
      </div>

      {/* File Details & Action Controls */}
      {selectedFile && previewUrl && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          backgroundColor: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: '0.8rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <FileText size={15} style={{ color: '#0d6efd', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedFile.name}
            </span>
            <span style={{ color: '#64748b', flexShrink: 0 }}>
              ({formatFileSize(selectedFile.size)})
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (fileInputRef?.current) fileInputRef.current.click();
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '0.725rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
              title="Select different image"
            >
              Change
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onFileRemoved) onFileRemoved();
                if (fileInputRef?.current) fileInputRef.current.value = '';
              }}
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '0.725rem',
                fontWeight: 600,
                color: '#b91c1c',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
              title="Remove selected image"
            >
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Message */}
      {validationError && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          color: '#b91c1c',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}
