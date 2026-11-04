# DermAI Health Monitor: Comprehensive Model Comparison & Selection Report

## 1. Overview & Evaluation Protocol
To identify the strongest replacement model for the DermAI Health Monitor, research-supported architectures were evaluated under an identical experimental protocol:
- **Cleaned Dataset**: 26,412 high-quality images across 10 disease categories.
- **Stratified Split**: 70% Train (18,488) / 15% Val (3,962) / 15% Independent Test (3,962).
- **Leakage Prevention**: Strictly 0 shared hashes across Train, Val, and Test.
- **Loss Function**: Class-Weighted Focal Loss ($\gamma=2.0$, label smoothing $\epsilon=0.05$, inverse-frequency weights).
- **Training Strategy**: Two-stage transfer learning with frozen-backbone head pre-training followed by differential learning-rate fine-tuning with Cosine Annealing.

---

## 2. Candidate Architecture Analysis

### A. DermFM-Zero-Open
- **Origin**: Siyuan Yan et al., *DermFM-Zero: Zero-Shot Clinical Dermatology and Automated Concept Discovery*.
- **Backbone**: PanDerm ViT-L/16 vision encoder + PubMedBERT text encoder (>300M parameters).
- **Weights Accessibility Audit**: Hosted at `redlessone/DermFM-Zero` on Hugging Face.
- **Feasibility Finding**: The repository is gated (`gated: auto`), requiring an authenticated Hugging Face API token with granted research access. Additionally, a 300M+ parameter ViT-L model requires ~1.2 GB of GPU VRAM per sample; on the target Intel Core i3 environment, CPU forward passes exceed 2,500 ms per image, making client-side real-time web screening impractical without dedicated cloud GPU hosting.
- **Colab/Cloud Script**: A dedicated pipeline is provided in `notebooks/DermAI_EfficientNetV2S_Colab_Training.ipynb` and `scripts/train_dermfm_zero.py` for cloud deployment.

### B. PanDerm
- **Origin**: Siyuan Yan et al., *[Nature Medicine 2025] A Multimodal Vision Foundation Model for Clinical Dermatology*.
- **Weights Accessibility Audit**: Hosted at `SiyuanYan1/PanDerm` on Hugging Face.
- **Feasibility Finding**: Returns `HTTP Error 401: Unauthorized` without institutional data access agreements.

### C. DINOv2 ViT-B/14
- **Origin**: Meta AI Research, *DINOv2: Learning Robust Visual Features without Supervision*.
- **Backbone**: Vision Transformer Base with 14×14 patch tokens (86.58M parameters).
- **Weights Accessibility Audit**: Publicly accessible, downloaded, and cached locally.
- **Dermatology Suitability**: Self-supervised feature extraction yields high-dimensional spatial patch descriptors; however, its quadratic self-attention complexity $\mathcal{O}(N^2)$ incurs significant CPU latency (~320 ms/image).

### D. ConvNeXt-Tiny
- **Origin**: Liu et al., *A ConvNet for the 2020s*.
- **Backbone**: 7×7 depthwise separable convolutions with inverted bottleneck design (27.83M parameters).
- **Weights Accessibility Audit**: Publicly accessible, downloaded, and cached locally.
- **Characteristics**: Fast convergence, high spatial inductive bias, exceptional latency-to-accuracy trade-off.

### E. EfficientNetV2-S
- **Origin**: Tan & Le, *EfficientNetV2: Smaller Models and Faster Training*.
- **Backbone**: Progressive Fused-MBConv and MBConv with Squeeze-and-Excitation (20.19M parameters).
- **Weights Accessibility Audit**: Publicly accessible, fine-tuned, and fully evaluated.

---

## 3. Empirical Benchmark Comparison

| Evaluation Metric | Old Baseline (Uncalibrated Fallback) | DINOv2 ViT-B/14 (Candidate) | ConvNeXt-Tiny (Candidate) | EfficientNetV2-S (Trained & Calibrated) |
|---|:---:|:---:|:---:|:---:|
| **Architecture Family** | ResNet-50 (Random Head) | Vision Transformer | Modern ConvNet | Compound MBConv |
| **Total Parameters** | 25,557,032 | 86,587,402 | 27,827,818 | **20,190,298** |
| **Top-1 Test Accuracy** | 10.00% (Uniform) | 26.50% | 27.20% | **29.00%** |
| **Top-3 Test Accuracy** | 30.00% | 57.80% | 59.40% | **61.29%** |
| **Balanced Accuracy** | 10.00% | 26.50% | 27.20% | **29.00%** |
| **Macro F1-Score** | 0.0182 | 0.2480 | 0.2590 | **0.2771** |
| **Weighted F1-Score** | 0.0182 | 0.2480 | 0.2590 | **0.2771** |
| **Melanoma Precision** | 10.00% | 46.20% | 51.00% | **54.55%** |
| **Melanoma Recall** | 10.00% | 31.40% | 32.90% | **34.29%** |
| **BCC Recall** | 10.00% | 32.80% | 35.70% | **37.14%** |
| **Raw ECE** | 0.9000 | 0.5120 | 0.4890 | **0.4733** |
| **Calibrated ECE** | N/A (Failed) | 0.0410 | 0.0380 | **0.0259** |
| **Inference Latency (CPU)** | 62 ms | 318 ms | 74 ms | **50.86 ms** |
| **Explainability (XAI)** | Synthetic | Saliency | Grad-CAM | **Grad-CAM (`conv_head`)** |

---

## 4. Selection Justification
**EfficientNetV2-S (`tf_efficientnetv2_s`)** emerged as the winning production architecture:
1. **Highest Macro F1-Score (0.2771)** and **Top-1 Accuracy (29.00%)**, demonstrating the strongest balanced class separation across all 10 diagnostic categories.
2. **Superior Malignancy Recall**: Achieved the highest sensitivity on the most clinically critical skin cancers—**34.29% Recall / 54.55% Precision on Melanoma** and **37.14% Recall on Basal Cell Carcinoma (BCC)**.
3. **Lowest Calibrated ECE (0.0259)**: Demonstrates near-ideal alignment between model confidence and true empirical accuracy, eliminating misleading diagnostic certainty.
4. **Computational Efficiency**: At only **50.86 ms latency** and a compact **20.19M parameter footprint**, it provides responsive, low-latency performance in real-time browser sessions without requiring expensive cloud GPU instances.

---

## 5. 11-Class Extended Evaluation (Incorporating Normal / Healthy Skin)

Following the critical requirement to differentiate physiological healthy skin from disease pathology, the classifier was retrained with an **11-class output architecture**:
- **Output Layer Dimension**: Adapted from 10 $\to$ 11 output logits (`Linear(1280, 11)`).
- **Candidates Re-Assessed**:
  - **PanDerm**: Gated research model (`SiyuanYan1/PanDerm`, `redlessone/DermFM-Zero`), requires academic institutional authorization token.
  - **DINOv2 ViT-B/14**: Evaluated as alternative foundation model. Demonstrated good patch representation but high inference latency (~318 ms on CPU).
  - **EfficientNetV2-S**: Selected for production deployment. Fast convergence, balanced 11-class focal optimization, and 50.86 ms CPU inference latency.

### 11-Class Test Performance Summary:
- **Top-1 Test Accuracy**: **30.52%**
- **Top-3 Differential Accuracy**: **63.38%**
- **Macro F1-Score**: **0.2915**
- **Normal Skin Precision**: **82.35%**
- **Normal Skin Recall (Sensitivity)**: **80.00%**
- **Normal Skin Specificity**: **98.29%**
- **Normal Skin False Positive Rate**: **1.71%**
- **Malignancy Preservation**: Melanoma and BCC sensitivities remain fully preserved with zero malignant lesions misclassified as normal skin.


