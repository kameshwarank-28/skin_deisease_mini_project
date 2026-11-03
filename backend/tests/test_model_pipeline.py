import torch
import numpy as np
from PIL import Image
from scripts.models import build_model
from scripts.dataset import get_transforms
from scripts.predict import check_image_quality

def test_model_build_and_forward_pass():
    model = build_model(model_name="resnet34", num_classes=10, pretrained=False)
    model.eval()

    dummy_input = torch.randn(2, 3, 224, 224)
    with torch.no_grad():
        output = model(dummy_input)

    assert output.shape == (2, 10), f"Expected shape (2, 10), got {output.shape}"

def test_transforms_output_shape():
    transform = get_transforms(image_size=224, is_training=False)
    pil_img = Image.new("RGB", (300, 400), color=(100, 150, 200))
    tensor = transform(pil_img)

    assert tensor.shape == (3, 224, 224), f"Expected shape (3, 224, 224), got {tensor.shape}"

def test_image_quality_blur_and_resolution_detection():
    # Low resolution test image
    tiny_img = Image.new("RGB", (64, 64), color=(50, 50, 50))
    quality = check_image_quality(tiny_img)

    assert quality["is_low_res"] is True, "Expected tiny image to trigger low resolution flag"
    assert len(quality["warnings"]) > 0, "Expected quality warning for low resolution"
