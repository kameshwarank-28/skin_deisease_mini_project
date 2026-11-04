# DermAI Health Monitor: Comprehensive Dataset Audit Report

## 1. Executive Summary
This document provides a complete audit of the clinical dermatological image dataset used for training, validation, and testing within the DermAI Health Monitor system.

---

## 2. Dataset Location & Discovery
- **Verified Primary Directory**: `Z:\IMG_CLASSES`
- **Total Images Scanned**: 27,154
- **Image File Format**: 100% JPEG (`.jpg`)
- **Color Mode**: 100% RGB (3 channels)
- **Image Dimensions**:
  - Width: Minimum 294 px, Maximum 1024 px (Mean: 678.8 px, Median: 600 px)
  - Height: Minimum 222 px, Maximum 1128 px (Mean: 569.9 px, Median: 479 px)
  - Aspect Ratio: Mean 1.24 (Consistent with macro-clinical and dermoscopic camera framing)
  - Total Storage Footprint: ~5,321 MB

---

## 3. Class Names & Image Distribution
The dataset contains exactly 10 diagnostic categories:

| Index | Exact Directory Name | Clean Diagnostic Label | Raw Count | Pruned Count | Class Share (%) |
|:---:|:---|:---|:---:|:---:|:---:|
| 0 | `1. Eczema 1677` | Eczema | 1,678 | 1,526 | 5.78% |
| 1 | `10. Warts Molluscum and other Viral Infections - 2103` | Warts Molluscum & Viral Infections | 2,103 | 1,850 | 7.00% |
| 2 | `2. Melanoma 15.75k` | Melanoma | 3,140 | 3,136 | 11.87% |
| 3 | `3. Atopic Dermatitis - 1.25k` | Atopic Dermatitis | 1,257 | 1,149 | 4.35% |
| 4 | `4. Basal Cell Carcinoma (BCC) 3323` | Basal Cell Carcinoma (BCC) | 3,323 | 3,316 | 12.56% |
| 5 | `5. Melanocytic Nevi (NV) - 7970` | Melanocytic Nevi (NV) | 7,970 | 7,967 | 30.16% |
| 6 | `6. Benign Keratosis-like Lesions (BKL) 2624` | Benign Keratosis-like Lesions (BKL) | 2,079 | 2,065 | 7.82% |
| 7 | `7. Psoriasis pictures Lichen Planus and related diseases - 2k` | Psoriasis & Lichen Planus | 2,055 | 1,948 | 7.38% |
| 8 | `8. Seborrheic Keratoses and other Benign Tumors - 1.8k` | Seborrheic Keratoses & Tumors | 1,847 | 1,824 | 6.91% |
| 9 | `9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k` | Fungal Infections (Tinea & Candidiasis) | 1,702 | 1,631 | 6.18% |
| **Total** | **All 10 Diagnostic Classes** | — | **27,154** | **26,412** | **100.00%** |

---

## 4. Data Cleaning, Corrupt Detection & Deduplication
1. **Corrupted Images**: **0 files**. Every single image was decoded via PIL / OpenCV without header errors or truncated byte streams.
2. **Cross-Class Duplicate Conflicts**: **117 images** were detected with identical MD5 hashes under differing, contradictory diagnostic labels (e.g. an identical image labeled both under Eczema and Atopic Dermatitis). All 117 conflicting entries were quarantined and excluded from training to prevent label ambiguity and contradictory gradient updates.
3. **Within-Class Redundant Duplicates**: **624 exact identical duplicate files** within the same class were detected. Redundant duplicates were removed, retaining a single canonical instance.
4. **Cleaned Usable Dataset**: **26,412 verified high-quality skin disease images**.

---

## 5. Stratified 70/15/15 Data Leakage Prevention
Splitting was performed with fixed random seed `seed=42`:
- **Training Subset (70%)**: 18,488 images
- **Validation Subset (15%)**: 3,962 images
- **Independent Test Subset (15%)**: 3,962 images

### Leakage Verification:
- Shared Hashes between Train and Val: **0**
- Shared Hashes between Train and Test: **0**
- Shared Hashes between Val and Test: **0**
- The independent test set was held strictly untouched and isolated during all training, validation, and hyperparameter tuning.

---

## 6. Class Imbalance Assessment
- **Majority Class**: Melanocytic Nevi (NV) with 7,967 images (30.16% of dataset).
- **Minority Class**: Atopic Dermatitis with 1,149 images (4.35% of dataset).
- **Imbalance Ratio**: **6.93 : 1**.
- **Mitigation**: Class-Weighted Focal Loss ($\gamma = 2.0$, label smoothing $\epsilon = 0.05$) with normalized inverse-frequency weights applied during training:
  $$\alpha_c = \frac{N_{\text{total}}}{C \cdot N_c}$$
  Class weights range from $0.332$ (Melanocytic Nevi) to $2.300$ (Atopic Dermatitis).
