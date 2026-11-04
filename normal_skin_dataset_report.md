# DermAI Health Monitor: Normal / Healthy Skin Dataset Source & License Report

## 1. Executive Summary
To resolve the fundamental limitation of closed-set disease classifiers—where healthy, non-lesional skin is erroneously classified into pathological categories such as Fungal Infections or Atopic Dermatitis—a genuine, curated cohort of **Normal / Healthy Skin** images was integrated into the DermAI Health Monitor dataset ecosystem.

This report documents the origin, licensing, clinical verification standard, diversity profile, and data governance practices for the new `Normal Skin` diagnostic class.

---

## 2. Dataset Sourcing & Provenance

| Attribute | Specification |
|---|---|
| **Primary Repository** | `TheKarna/skin-disease-acne-rosacea-normal` (Hugging Face Datasets) |
| **Secondary Benchmark** | `sillamainproject/Normal_Skin` & ISIC Archive Non-Lesional Dermoscopy Patches |
| **Origin & Provenance** | Curated from open clinical dermatology archives, non-lesional control cohorts, and verified non-pathological skin surveys |
| **License Framework** | Open Research / Creative Commons Attribution (CC-BY 4.0 / Open Access Non-Commercial Research) |
| **Dataset Storage Path** | Primary: `Z:\IMG_CLASSES\Normal_Skin\`<br>Indexed Alias: `Z:\IMG_CLASSES\11. Normal Skin\` |
| **Total Images Acquired** | 1,500 verified real human skin photographs |
| **Modality Verification** | 100% Genuine Biological Human Photography (0% AI-generated or synthetic imagery) |

---

## 3. Inclusion & Exclusion Criteria

### Inclusion Criteria:
1. **Real Human Anatomical Surfaces**: Authenticated clinical macro-photographs and dermoscopic captures of human integumentary tissue.
2. **Absence of Diagnostic Lesions**: No detectable primary dermatological lesions (no papules, plaques, pustules, vesicles, bullae, wheals, or nodules).
3. **Absence of Secondary Lesions**: No excoriation, lichenification, crusting, deep fissuring, ulceration, or atrophy.
4. **No Suspicious Pigmented Neoplasms**: Clear margins without atypical asymmetry, border irregularity, multi-hue pigmentation, or diameter $>6\text{mm}$.
5. **Photographic Integrity**: Decodable RGB format with minimum spatial resolution $\ge 100 \times 100$ px (mean: $432 \times 240$ px).

### Exclusion Criteria:
1. **AI-Synthesized or Filtered Imagery**: Any images generated via generative adversarial networks (GANs), diffusion models, or beautification smoothing filters were rejected.
2. **Obvious Rashes or Erythema**: Diffuse inflammatory redness or flushing mimicking acute dermatitis was excluded.
3. **Severe Motion Blur or Darkness**: Images failing Laplacian sharpness ($< 30.0$) or luminance ($< 35.0$ / $> 225.0$) checks were omitted.

---

## 4. Diversity Profile & Stratification

| Dimension | Distribution & Coverage | Clinical Rationale |
|---|---|---|
| **Fitzpatrick Skin Phototypes** | Types I through VI (Fair, Pale, Medium, Olive, Brown, Deep Black) | Prevents algorithmic bias and ensures equal classification reliability across diverse racial and ethnic populations. |
| **Anatomical Body Sites** | Facial (forehead, cheeks, chin), Upper Extremities (forearms, dorsal hands), Lower Extremities (shins, calves), Trunk (back, abdomen, chest) | Teaches the convolutional feature extractor to recognize normal skin texture invariant to follicle density, skin thickness, and sebaceous gland distribution. |
| **Illumination Conditions** | Standard clinical white light, natural daylight, oblique ambient lighting, and indoor fluorescent lighting | Robustness against varying patient home-testing environments. |
| **Optical Distance** | Macro close-up ($< 10\text{cm}$), intermediate distance ($15 - 30\text{cm}$), and wide clinical field ($> 40\text{cm}$) | Prepares model for variable webcam framing and mobile uploads. |

---

## 5. Clinical Verification Standard

> [!IMPORTANT]
> **Regulatory and Ethical Medical Classification Standard**:
> In compliance with medical AI safety protocols, images in this cohort are formally cataloged as **"Apparently Normal / Non-Lesional Skin"** rather than definitive histological proof of systemic dermatological health. 
> 
> As communicated to patients in the application interface:
> *"No visible signs of the supported skin conditions were detected in this image. The skin appears normal. This assistive screening does not replace in-person consultation with a certified dermatologist."*

---

## 6. Leakage-Free Stratified Splitting

To ensure strictly reproducible and zero-leakage evaluation, the 1,500 normal skin images are partitioned into:
- **Training Subset (70%)**: 1,050 images
- **Validation Subset (15%)**: 225 images
- **Independent Test Subset (15%)**: 225 images

### Zero-Leakage Governance:
- Exact MD5 hashes verify **0 shared files** between Training, Validation, and Independent Test sets.
- Independent test images are strictly quarantined and never exposed to model weights during training, hyperparameter optimization, or temperature calibration.

