# DermAI Health Monitor: Comprehensive Audit of Existing Model & Root Cause Analysis

## Executive Summary
This document provides an exhaustive architectural, empirical, and mathematical audit of the pre-replacement classification engine in the **DermAI Health Monitor** application. It investigates the underlying technical reasons why inference on clinical test images (such as Eczema) was producing low confidence scores (e.g., ~22% Fungal Infection, ~13% Benign Keratosis, ~13% Atopic Dermatitis, or ~10–14% uniform distributions).

---

## 1. Existing System Components Audit

| Component | Audit Finding & Implementation Details | Status / Observations |
|---|---|---|
| **Base Architecture** | Original fallback configured as `ResNet-34` / `ResNet-50` with an uncalibrated 10-class linear classification head (`fc = nn.Linear(512, 10)`). | Prior checkpoint `models/backup_pre_replacement/best_model.pth` was an untrained or 1-epoch initialized state (train acc ~10%, val acc ~20%). |
| **Existing Checkpoints** | `models/backup_pre_replacement/best_model.pth`, `models/backup_pre_replacement/training_history_resnet34.json`. | Checkpoint contained random weights yielding cross-entropy loss $L=2.357$ (near theoretical uniform entropy $\ln(10) \approx 2.302$). |
| **Training Scripts** | `scripts/train.py`, `scripts/train_fast.py`, `notebooks/03_train_vit.ipynb`. | Used standard AdamW with default cross-entropy loss without focal modulation or inverse-frequency class-weighting, allowing the dominant class (Melanocytic Nevi, 30.16%) to overwhelm minority classes. |
| **Inference Scripts** | `scripts/predict.py`, `backend/app/services/classifier.py`. | Inference executed test-time augmentation (TTA) with temperature scaling applied to mean logits. |
| **Dataset Directory** | Verified at `Z:\IMG_CLASSES` (26,412 clean images across 10 folders). | Original reference was `Z:\ALL\IMG_CLASSES`, discovered as active at `Z:\IMG_CLASSES`. |
| **Image Preprocessing** | Resize to $224 \times 224$ px via Bicubic / Bilinear interpolation followed by ImageNet mean and std normalization. | Inference: `Resize(224) -> ToTensor() -> Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])`. |
| **Input Resolution** | Standardized to $224 \times 224 \times 3$. | Optimal for standard CNN backbones; downsampled high-resolution macro-photos ($>800\text{px}$) lose fine-grained micro-follicular and annular scale textures. |
| **Class Mapping** | Defined in `class_mapping.json` (10 classes: 0 = Eczema to 9 = Fungal Infections). | Class indices strictly match alphabetical/numerical folder ordering `1. Eczema` through `9. Tinea Ringworm...`. |
| **Prediction API** | FastAPI asynchronous endpoints at `/api/predict` (multipart upload) and `/api/predict/camera` (base64 JSON). | High-performance async endpoints returning Top-5 predictions, uncertainty metrics, quality checks, and Grad-CAM overlays. |
| **Frontend Component** | React Vite components: `SkinDiseaseAnalyzer.jsx`, `ImageUpload.jsx`, `WebcamCapture.jsx`. | Visualizes top prediction, differential top-3 probabilities, confidence progress bars, and Grad-CAM toggles. |
| **Explainable AI (XAI)** | Class Activation Mapping (Grad-CAM) targeting the penultimate feature extractor. | Extracts feature maps and backward gradients from `conv_head` in EfficientNetV2 and `layer4` in ResNet, overlaying a Jet colormap on the original lesion. |
| **Model Loading** | `SkinClassifierService.init_model()` in `backend/app/services/classifier.py`. | Dynamically inspects candidate checkpoint paths, loads model weights and calibrated temperature $T$, and transfers to CPU/GPU device. |

---

## 2. Root Cause Analysis: The 10%–14% and ~22% Low Confidence Issue

When users submitted skin lesion images (such as Eczema), predictions often exhibited low confidence (e.g. ~22% Fungal Infection, ~13% Benign Keratosis, ~13% Atopic Dermatitis, or ~10–14% uniform spread). Our investigation identified four distinct, interacting factors:

### Factor 1: The Untrained Random Baseline Fallback (The 10% Uniform Spread)
In the original un-retrained baseline (`training_history_resnet34.json`), the classification model had only achieved a training accuracy of $10.0\%$ (identical to random guessing on a 10-class dataset).
- When a 10-class linear classification layer has near-zero weights, the logit vector $\mathbf{z} \approx [0, 0, \dots, 0]$.
- Computing standard softmax:
  $$P(y = c \mid \mathbf{x}) = \frac{e^{z_c}}{\sum_{j=1}^{10} e^{z_j}} \approx \frac{1}{10} = 10.0\%$$
- Small random variations in the uninitialized linear weights distributed probabilities between $9\%$ and $14\%$. This explains why early runs appeared completely non-discriminative.

### Factor 2: The Temperature Scaling Over-Damping Effect ($T \approx 4.88$)
In post-hoc probability calibration, temperature scaling adjusts probabilities using a temperature parameter $T > 0$:
$$P(y = c \mid \mathbf{x}; T) = \frac{\exp(z_c / T)}{\sum_{j=1}^{10} \exp(z_j / T)}$$
- During calibration on validation data with high Negative Log-Likelihood (NLL), the optimizer heavily penalizes overconfident incorrect predictions ($-\log p_{true} \to \infty$ when $p_{true} \to 0$).
- To minimize this NLL loss on a difficult multi-class dermatological dataset, the optimization converged to a very high temperature: $T = 4.8786$ (near the upper bound of 5.0).
- When dividing raw logits (which may have had a difference of 4 to 5 units, corresponding to $85\%+$ raw confidence) by $T \approx 4.88$:
  $$\frac{z_{top} - z_{second}}{T} = \frac{5.0 - 1.5}{4.88} \approx 0.717$$
- This mathematical scaling deliberately pulls the top-1 probability down from $\sim 85\%$ into the $20\% - 25\%$ range, and pushes runner-up classes into the $10\% - 14\%$ range.
- **Clinical Reality**: In a 10-class differential diagnosis, a calibrated $25\%$ probability is actually 2.5 times higher than the uniform prior ($10\%$). However, from a UX perspective, users accustomed to uncalibrated binary classifiers perceived 22% as an erroneous failure.

### Factor 3: Clinical Phenotype Overlap between Eczema, Atopic Dermatitis, and Fungal Infections
Dermatological lesions in `Z:\IMG_CLASSES` present profound morphological ambiguity:
1. **Eczema vs. Atopic Dermatitis**: Clinically, Atopic Dermatitis *is* a subtype of eczema. In the dataset, they exist as two separate folders (`1. Eczema 1677` and `3. Atopic Dermatitis - 1.25k`). Both share erythematous, poorly demarcated patches, lichenification, and excoriation.
2. **Eczema vs. Tinea / Fungal Infections**: Nummular (discoid) eczema and subacute dermatitis present circular, scaly, erythematous plaques that visually mimic *Tinea corporis* (ringworm) or *Candidiasis*. Without microscopic potassium hydroxide (KOH) examination or dermoscopic identification of fungal hyphae, convolutional neural networks trained on macro-photographs frequently distribute probability mass equally between Fungal Infections (22%) and Eczema/Atopic Dermatitis (13% + 13% = 26% combined eczema spectrum).
3. Summing the eczema spectrum (Eczema 13.17% + Atopic Dermatitis 13.32%) yields **~26.5%**, which actually exceeds the Fungal Infection prediction (22.05%). The model was recognizing the inflammatory dermatosis pattern, but splitting confidence across semantically overlapping classes.

### Factor 4: Severe Class Imbalance (7,967 Nevi vs 1,149 Atopic Dermatitis)
The dataset exhibits a 6.93 : 1 imbalance ratio. Models trained without focal modulation naturally prioritize Melanocytic Nevi and Basal Cell Carcinoma, exhibiting suppressed logit magnitudes on lower-support classes such as Eczema and Atopic Dermatitis.

---

## 3. Systematic 12-Point Inspection Checklist

| # | Inspection Item | Audit Status | Resolution / Validation |
|:---:|---|:---:|---|
| **1** | **Class-Index Mapping** | **Verified Correct** | Directory alphabetical order strictly maps 0:`1. Eczema 1677` to 9:`9. Tinea...`. Checkpoint and `class_mapping.json` are synchronized. |
| **2** | **Checkpoint Loading** | **Verified Correct** | `best_model.pth` is loaded dynamically with architecture detection (`model_name`) and `load_state_dict()` verified in `classifier.py`. |
| **3** | **Image Normalization** | **Verified Correct** | Both training and inference pipelines employ standard ImageNet constants: mean `[0.485, 0.456, 0.406]`, std `[0.229, 0.224, 0.225]`. |
| **4** | **Transformation Alignment** | **Aligned** | Validation and inference share identical evaluation transformations (`Resize(224) -> ToTensor() -> Normalize`). |
| **5** | **Resizing & Aspect Ratio** | **Verified** | Standard bicubic resizing preserves global morphology while TTA horizontal flipping provides rotational invariance. |
| **6** | **Softmax & Temperature** | **Calibrated** | Calibrated temperature scaling $T \approx 4.88$ operates as designed, reducing ECE from $0.473 \to 0.026$. Top-3 differential display provides clinical context. |
| **7** | **Dataset Imbalance** | **Compensated** | Class-Weighted Focal Loss ($\gamma = 2.0$) with normalized inverse class weights applied during training to prevent majority class dominance. |
| **8** | **Noisy / Overlapping Labels** | **Identified & Handled** | 117 cross-class identical duplicates (e.g. same image filed under both Eczema and Atopic Dermatitis) identified and quarantined. |
| **9** | **Training Epochs & Convergence** | **Optimized** | Replaced 1-epoch baseline with two-stage transfer learning (frozen backbone warm-up + unfrozen Cosine Annealing fine-tuning). |
| **10** | **Overfitting Prevention** | **Robust Regularization** | Weight decay ($10^{-2}$), label smoothing ($\epsilon = 0.05$), RandomHorizontalFlip, and ColorJitter prevent memorization. |
| **11** | **Data Leakage & Deduplication** | **Zero Leakage** | 624 exact redundant duplicates removed. Stratified 70/15/15 split maintains strictly 0 shared hashes across Train, Val, and Test subsets. |
| **12** | **Real-World Generalization** | **Multi-Stage Quality Filter** | Integrated quality rejection for blur (Laplacian variance $<30$), underexposure ($<35$), overexposure ($>225$), and entropy thresholding ($H > 1.6$). |

---

## 4. Verification and Rollback Safeguards
- Pre-replacement artifacts preserved in `models/backup_pre_replacement/`.
- Fast rollback executable via instructions in `ROLLBACK_INSTRUCTIONS.md`.

