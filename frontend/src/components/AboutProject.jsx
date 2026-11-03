import React from 'react';

export default function AboutProject() {
  return (
    <div className="project-card">
      <div className="project-card-header">
        Project Overview & Methodology
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.9rem' }}>
        <div>
          <h4 style={{ color: '#212529', marginBottom: 6 }}>1. Problem Statement</h4>
          <p style={{ color: '#495057' }}>
            Skin diseases affect millions of people worldwide. This project implements a Deep Learning & Vision Transformer system capable of classifying 10 major dermatological disease classes from clinical photographs and dermoscopic images.
          </p>
        </div>

        <div>
          <h4 style={{ color: '#212529', marginBottom: 6 }}>2. Dataset Information</h4>
          <p style={{ color: '#495057' }}>
            The system is trained on a curated medical dataset of <strong>26,412 clean images</strong> across 10 disease categories:
          </p>
          <ul style={{ paddingLeft: 24, marginTop: 6, color: '#495057' }}>
            <li>Eczema</li>
            <li>Melanoma (Malignant High Risk)</li>
            <li>Atopic Dermatitis</li>
            <li>Basal Cell Carcinoma (BCC)</li>
            <li>Melanocytic Nevi (NV)</li>
            <li>Benign Keratosis-like Lesions (BKL)</li>
            <li>Psoriasis & Lichen Planus</li>
            <li>Seborrheic Keratoses & Benign Tumors</li>
            <li>Fungal Infections (Tinea Ringworm & Candidiasis)</li>
            <li>Viral Infections (Warts & Molluscum)</li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#212529', marginBottom: 6 }}>3. Model Architecture & Pipeline</h4>
          <table className="table-custom">
            <thead>
              <tr>
                <th>Component</th>
                <th>Method / Specification</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Deep Neural Network</strong></td>
                <td>Vision Transformer (ViT) & ResNet Deep Transfer Learning</td>
              </tr>
              <tr>
                <td><strong>Loss Function</strong></td>
                <td>Multi-Class Focal Loss (gamma=2.0) with Label Smoothing</td>
              </tr>
              <tr>
                <td><strong>Explainable AI</strong></td>
                <td>Attention Gradient Heatmaps / Saliency Overlays</td>
              </tr>
              <tr>
                <td><strong>Data Augmentation</strong></td>
                <td>Random Cropping, Flips, Rotations, Color Jitter</td>
              </tr>
              <tr>
                <td><strong>Inference Mode</strong></td>
                <td>4-Way Test-Time Augmentation (TTA) with Temperature Calibration</td>
              </tr>
              <tr>
                <td><strong>Backend Stack</strong></td>
                <td>FastAPI (Python) + SQLite Database + PyTorch</td>
              </tr>
              <tr>
                <td><strong>Frontend Stack</strong></td>
                <td>React + Vite</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
