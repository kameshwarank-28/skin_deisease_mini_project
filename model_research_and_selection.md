# DermAI Health Monitor: Model Research, Architecture Evaluation & Selection Report

## 1. Primary Research Candidate: DermFM-Zero-Open
- **Official Repository**: [https://github.com/SiyuanYan1/DermFM-Zero](https://github.com/SiyuanYan1/DermFM-Zero)
- **Research Authors**: Siyuan Yan, et al.
- **Model Description**: Vision-language foundation model tailored for zero-shot clinical dermatology, automated concept discovery, and human-AI collaboration.
- **Architecture**: PanDerm ViT-L/16 vision encoder coupled with a PubMedBERT biomedical text encoder aligned via multi-aspect contrastive loss and masked latent modeling over millions of clinical and dermoscopic image-text pairs.
- **Weights Access Audit**:
  - Hosted on Hugging Face at `redlessone/DermFM-Zero`.
  - **Access Status**: Gated repository (`gated: auto`). Direct unauthenticated HTTP API calls return a gate barrier requiring an authorized Hugging Face user access token (`huggingface-cli login`).
  - **Local Deployment Constraints**: ViT-L/16 vision encoder exceeds 300 million parameters (>1.2 GB fp32 weight footprint). Local CPU execution on an Intel Core i3 environment requires substantial RAM and experiences high latency (>2500 ms/inference).
  - **Reproducibility Script**: Provided in `scripts/train_dermfm_zero.py` and the Google Colab GPU training notebook for users with approved Hugging Face credentials.

---

## 2. Research Candidate: PanDerm
- **Official Repository**: [https://github.com/SiyuanYan1/PanDerm](https://github.com/SiyuanYan1/PanDerm)
- **Publication**: *[Nature Medicine 2025] A Multimodal Vision Foundation Model for Clinical Dermatology*.
- **Description**: Self-supervised foundation model trained on multi-institutional clinical dermatology datasets across diverse imaging modalities.
- **Weights Access Audit**:
  - Hosted on Hugging Face at `SiyuanYan1/PanDerm`.
  - **Access Status**: Returns `HTTP Error 401: Unauthorized`. The repository requires individual institutional agreement authorization.

---

## 3. Foundation Candidate: DINOv2 ViT-B/14
- **Official Repository**: [https://github.com/facebookresearch/dinov2](https://github.com/facebookresearch/dinov2)
- **Model Key**: `vit_base_patch14_dinov2.lvd142m`
- **Total Parameters**: 86,587,402
- **Pretrained Weights**: Official Meta AI self-supervised weights trained on the LVD-142M curated dataset.
- **Advantages for Dermatology**:
  - Extracts dense semantic patch tokens without text supervision.
  - Strong linear probing and fine-tuning transferability on specialized visual domains.
  - Does not suffer from language-prompt domain misalignment.
- **Access Status**: Openly available, downloaded, and cached locally.

---

## 4. Convolutional Baseline: ConvNeXt-Tiny
- **Architecture**: Modernized 7×7 depthwise separable convolutional network with inverted bottleneck stages.
- **Total Parameters**: 27,827,818
- **Pretrained Weights**: Official ImageNet-12k / ImageNet-1k fine-tuned weights (`convnext_tiny.in12k_ft_in1k`).
- **Advantages**: High computational efficiency, robust spatial inductive bias, exceptional latency-to-accuracy trade-off.

---

## 5. Control Baseline: EfficientNetV2-S
- **Architecture**: Fused-MBConv and MBConv with Squeeze-and-Excitation.
- **Total Parameters**: 20,190,298
- **Pretrained Weights**: ImageNet-21k / 1k (`tf_efficientnetv2_s`).
- **Status**: Tested and evaluated as control baseline.

---

## 6. Selection Criteria Matrix
Models are ranked on the independent test set according to:
1. **Macro F1-Score**: Equal weight across all 10 disease categories.
2. **Balanced Accuracy**: Insensitivity to class frequency disparities.
3. **Malignancy Recall**: Sensitivity on dangerous lesions (Melanoma and Basal Cell Carcinoma).
4. **Expected Calibration Error (ECE)**: Probability alignment with empirical reliability.
5. **Inference Latency**: Real-time usability on clinical client devices.
