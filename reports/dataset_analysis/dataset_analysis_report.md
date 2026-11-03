# Dataset Quality & Exploratory Data Analysis Report

**Project**: An AI-Based Transformer for Real-Time Skin Disease Classification
**Dataset Path**: `Z:\ALL\IMG_CLASSES`

## 1. Summary Metrics

| Metric | Value |
| :--- | :--- |
| Total Images Scanned | **27,153** |
| Valid Readable Images | **27,153 (100.00%)** |
| Corrupted / Unreadable | **0** |
| Classes Count | **10** |
| Duplicate Image Files | **1,212** (624 redundant) |
| Cross-Class Duplicates | **117** |
| Unique Image Hashes | **26,529** |
| Imbalance Ratio | **6.34:1** |
| Total Disk Size | **5321.4 MB** |

## 2. Per-Class Statistics

| # | Class Name | Total Files | Valid | Corrupted | Duplicates | % Share | Avg Size (W x H) |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `1. Eczema 1677` | 1,677 | 1,677 | 0 | 251 | 6.18% | 615 x 530 px |
| 2 | `10. Warts Molluscum and other Viral Infections - 2103` | 2,103 | 2,103 | 0 | 455 | 7.75% | 549 x 415 px |
| 3 | `2. Melanoma 15.75k` | 3,140 | 3,140 | 0 | 8 | 11.56% | 512 x 512 px |
| 4 | `3. Atopic Dermatitis - 1.25k` | 1,257 | 1,257 | 0 | 139 | 4.63% | 468 x 380 px |
| 5 | `4. Basal Cell Carcinoma (BCC) 3323` | 3,323 | 3,323 | 0 | 14 | 12.24% | 958 x 935 px |
| 6 | `5. Melanocytic Nevi (NV) - 7970` | 7,970 | 7,970 | 0 | 6 | 29.35% | 701 x 513 px |
| 7 | `6. Benign Keratosis-like Lesions (BKL) 2624` | 2,079 | 2,079 | 0 | 28 | 7.66% | 832 x 764 px |
| 8 | `7. Psoriasis pictures Lichen Planus and related diseases - 2k` | 2,055 | 2,055 | 0 | 147 | 7.57% | 598 x 505 px |
| 9 | `8. Seborrheic Keratoses and other Benign Tumors - 1.8k` | 1,847 | 1,847 | 0 | 43 | 6.8% | 655 x 494 px |
| 10 | `9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k` | 1,702 | 1,702 | 0 | 121 | 6.27% | 649 x 518 px |

## 3. Dimensions & Color Modes

- **Width (px)**: Min=294, Max=1024, Mean=678.83, Median=600.0
- **Height (px)**: Min=222, Max=1128, Mean=569.92, Median=479.0
- **Aspect Ratio**: Mean=1.2442, Median=1.3333
- **Color Modes**: RGB: 27,153
- **Extensions**: .jpg: 27,153