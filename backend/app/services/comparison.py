import cv2
import numpy as np
from pathlib import Path
from PIL import Image

def analyze_visual_comparison(img1_path: Path, img2_path: Path) -> dict:
    """
    Performs neutral computer-vision based visual difference estimation
    using OpenCV color histograms and edge maps.
    Generates observational text with mandatory clinical disclaimers.
    """
    try:
        im1 = cv2.imread(str(img1_path))
        im2 = cv2.imread(str(img2_path))

        if im1 is None or im2 is None:
            return {
                "similarity_score": 0.5,
                "histogram_distance": 0.5,
                "color_shift_detected": False,
                "observed_changes": [
                    {
                        "observation_type": "Image Quality",
                        "summary": "Comparison is inconclusive due to image quality or alignment.",
                        "neutral_metric": "File reading / decoding limitation"
                    }
                ],
                "disclaimer": get_comparison_disclaimer()
            }

        # Resize to standard comparison resolution
        target_size = (300, 300)
        im1_resized = cv2.resize(im1, target_size, interpolation=cv2.INTER_AREA)
        im2_resized = cv2.resize(im2, target_size, interpolation=cv2.INTER_AREA)

        # 1. Color Histogram Comparison (HSV color space)
        hsv1 = cv2.cvtColor(im1_resized, cv2.COLOR_BGR2HSV)
        hsv2 = cv2.cvtColor(im2_resized, cv2.COLOR_BGR2HSV)

        hist1 = cv2.calcHist([hsv1], [0, 1], None, [50, 60], [0, 180, 0, 256])
        hist2 = cv2.calcHist([hsv2], [0, 1], None, [50, 60], [0, 180, 0, 256])
        cv2.normalize(hist1, hist1, 0, 1, cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, 0, 1, cv2.NORM_MINMAX)

        # Correlation (1 = identical, 0 = different)
        color_correlation = float(cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL))
        # Bhattacharyya distance (0 = identical, 1 = maximum difference)
        bhatt_dist = float(cv2.compareHist(hist1, hist2, cv2.HISTCMP_BHATTACHARYYA))

        # 2. Redness / Hue channel comparison
        # Redness in RGB: compare R/(R+G+B)
        rgb1 = cv2.cvtColor(im1_resized, cv2.COLOR_BGR2RGB).astype(float)
        rgb2 = cv2.cvtColor(im2_resized, cv2.COLOR_BGR2RGB).astype(float)
        total1 = rgb1[:, :, 0] + rgb1[:, :, 1] + rgb1[:, :, 2] + 1e-5
        total2 = rgb2[:, :, 0] + rgb2[:, :, 1] + rgb2[:, :, 2] + 1e-5
        red_ratio1 = float(np.mean(rgb1[:, :, 0] / total1))
        red_ratio2 = float(np.mean(rgb2[:, :, 0] / total2))
        red_diff = abs(red_ratio2 - red_ratio1)

        # 3. Structural / Edge gradient comparison
        gray1 = cv2.cvtColor(im1_resized, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(im2_resized, cv2.COLOR_BGR2GRAY)
        lap1 = cv2.Laplacian(gray1, cv2.CV_64F)
        lap2 = cv2.Laplacian(gray2, cv2.CV_64F)
        edge_diff = float(np.mean(np.abs(lap1 - lap2)))

        observations = []

        # Color shift observation
        color_shift = bhatt_dist > 0.35
        if color_shift:
            observations.append({
                "observation_type": "Color Tone & Lighting",
                "summary": "The overall color tone and illumination between the two photographs appear visually different.",
                "neutral_metric": f"Histogram variation index: {bhatt_dist:.2f}"
            })
        else:
            observations.append({
                "observation_type": "Color Tone & Lighting",
                "summary": "Overall color distribution and background illumination show comparable tone.",
                "neutral_metric": f"Histogram correlation: {max(0.0, color_correlation):.2f}"
            })

        # Redness observation
        if red_diff > 0.04:
            observations.append({
                "observation_type": "Surface Erythema (Redness)",
                "summary": "Visible redness appears visually different across the photographed region.",
                "neutral_metric": f"Relative red-channel variation: {red_diff * 100:.1f}%"
            })
        else:
            observations.append({
                "observation_type": "Surface Erythema (Redness)",
                "summary": "No marked difference in visible redness was observed between images.",
                "neutral_metric": "Minimal chrominance delta detected"
            })

        # Texture and boundary observation
        if edge_diff > 15.0:
            observations.append({
                "observation_type": "Surface Texture & Edges",
                "summary": "The photographed area shows visible variations in edge sharpness or surface texture.",
                "neutral_metric": f"Gradient delta score: {edge_diff:.1f}"
            })
        else:
            observations.append({
                "observation_type": "Surface Texture & Edges",
                "summary": "Surface texture and boundary appearance demonstrate consistent edge contours.",
                "neutral_metric": "Consistent edge contour density"
            })

        # Overall similarity score 0.0 - 1.0
        similarity = float(np.clip(1.0 - (bhatt_dist * 0.6 + (edge_diff / 50.0) * 0.4), 0.1, 0.98))

        return {
            "similarity_score": round(similarity, 2),
            "histogram_distance": round(bhatt_dist, 2),
            "color_shift_detected": color_shift,
            "observed_changes": observations,
            "disclaimer": get_comparison_disclaimer()
        }

    except Exception as e:
        print(f"[Comparison Service Error] {e}")
        return {
            "similarity_score": 0.5,
            "histogram_distance": 0.5,
            "color_shift_detected": False,
            "observed_changes": [
                {
                    "observation_type": "Analysis Status",
                    "summary": "Comparison is inconclusive due to image quality or alignment.",
                    "neutral_metric": f"Analysis encountered error: {str(e)}"
                }
            ],
            "disclaimer": get_comparison_disclaimer()
        }

def get_comparison_disclaimer() -> str:
    return (
        "IMPORTANT MEDICAL DISCLAIMER — OBSERVED VISUAL CHANGES:\n"
        "Visual differences in skin photographs are heavily influenced by ambient lighting conditions, "
        "camera sensor white balance, distance to the skin, camera angle, image orientation, and skin positioning. "
        "Automated image comparisons represent observational metrics only and must NEVER be interpreted as "
        "evidence of treatment success, treatment failure, or disease progression. "
        "This tool is not a medical device. Always consult your board-certified dermatologist for clinical assessment."
    )

