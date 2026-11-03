import os
import sys
import json
import hashlib
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
from PIL import Image, ImageFile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm

ImageFile.LOAD_TRUNCATED_IMAGES = False
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif'}

def compute_md5(file_path):
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def compute_dhash(image, hash_size=8):
    try:
        resized = image.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.BILINEAR)
        pixels = np.array(resized.getdata(), dtype=np.float32).reshape((hash_size, hash_size + 1))
        diff = pixels[:, 1:] > pixels[:, :-1]
        return ''.join(['1' if b else '0' for b in diff.flatten()])
    except Exception:
        return None

def analyze_single_image(args_tuple):
    file_path, class_name = args_tuple
    file_path_obj = Path(file_path)
    file_size_kb = file_path_obj.stat().st_size / 1024.0
    ext = file_path_obj.suffix.lower()

    result = {
        'file_path': str(file_path),
        'file_name': file_path_obj.name,
        'class_name': class_name,
        'file_size_kb': round(file_size_kb, 2),
        'extension': ext,
        'is_supported_ext': ext in SUPPORTED_EXTENSIONS,
        'is_corrupted': False,
        'corruption_error': None,
        'width': None,
        'height': None,
        'aspect_ratio': None,
        'color_mode': None,
        'md5': None,
        'dhash': None
    }

    if not result['is_supported_ext']:
        result['is_corrupted'] = True
        result['corruption_error'] = 'Unsupported extension: ' + ext
        return result

    try:
        result['md5'] = compute_md5(file_path)
        with Image.open(file_path) as img:
            img.verify()

        with Image.open(file_path) as img:
            img.load()
            result['width'], result['height'] = img.size
            result['aspect_ratio'] = round(img.size[0] / img.size[1], 4) if img.size[1] > 0 else 0
            result['color_mode'] = img.mode
            result['dhash'] = compute_dhash(img)

    except Exception as e:
        result['is_corrupted'] = True
        result['corruption_error'] = str(e)

    return result

def run_analysis(dataset_dir: str, output_dir: str, max_workers: int = 8):
    dataset_path = Path(dataset_dir)
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print('=' * 65)
    print('Starting Comprehensive Dataset Analysis')
    print(f'Dataset Path: {dataset_path}')
    print(f'Reports Path: {out_path}')
    print('=' * 65)

    if not dataset_path.exists():
        raise FileNotFoundError(f'Dataset directory not found: {dataset_path}')

    class_folders = sorted([d for d in dataset_path.iterdir() if d.is_dir()])
    if not class_folders:
        raise ValueError(f'No class subdirectories found in {dataset_path}')

    print(f'Detected {len(class_folders)} classes:')
    for idx, c in enumerate(class_folders, 1):
        print(f'  [{idx:02d}] {c.name}')

    tasks = []
    for c_dir in class_folders:
        for f in c_dir.iterdir():
            if f.is_file():
                tasks.append((str(f), c_dir.name))

    total_files = len(tasks)
    print(f'\nTotal image files located: {total_files:,}')
    print(f'Scanning images across {max_workers} worker threads...')

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(analyze_single_image, t) for t in tasks]
        for fut in tqdm(as_completed(futures), total=total_files, desc='Scanning images', unit='img'):
            results.append(fut.result())

    df = pd.DataFrame(results)

    metadata_csv_path = out_path / 'image_level_metadata.csv'
    df.to_csv(metadata_csv_path, index=False)
    print(f'Saved image metadata to: {metadata_csv_path}')

    corrupted_df = df[df['is_corrupted'] == True]
    corrupted_csv_path = out_path / 'corrupted_files.csv'
    corrupted_df.to_csv(corrupted_csv_path, index=False)
    print(f'Corrupted / Unreadable files found: {len(corrupted_df):,}')

    valid_df = df[df['is_corrupted'] == False].copy()
    valid_count = len(valid_df)
    print(f'Valid readable images: {valid_count:,} ({valid_count/total_files*100:.2f}%)')

    md5_counts = valid_df['md5'].value_counts()
    duplicate_hashes = md5_counts[md5_counts > 1].index
    duplicates_df = valid_df[valid_df['md5'].isin(duplicate_hashes)].sort_values('md5')
    duplicates_csv_path = out_path / 'exact_duplicates.csv'
    duplicates_df.to_csv(duplicates_csv_path, index=False)

    num_duplicate_images = len(duplicates_df)
    num_unique_hashes = len(valid_df['md5'].unique())
    num_redundant_copies = valid_count - num_unique_hashes
    print(f'Exact duplicate files detected: {num_duplicate_images:,} ({num_redundant_copies:,} redundant copies)')

    cross_class_dups = []
    for md5_val, group in duplicates_df.groupby('md5'):
        classes_in_group = group['class_name'].unique()
        if len(classes_in_group) > 1:
            cross_class_dups.append({
                'md5': md5_val,
                'classes': list(classes_in_group),
                'count': len(group),
                'files': list(group['file_path'])
            })
    print(f'Cross-class duplicates found: {len(cross_class_dups):,}')

    class_stats = []
    for c_dir in class_folders:
        c_name = c_dir.name
        c_all = df[df['class_name'] == c_name]
        c_valid = valid_df[valid_df['class_name'] == c_name]
        c_corrupt = corrupted_df[corrupted_df['class_name'] == c_name]
        c_dups = duplicates_df[duplicates_df['class_name'] == c_name]

        class_stats.append({
            'class_name': c_name,
            'total_files': len(c_all),
            'valid_images': len(c_valid),
            'corrupted_images': len(c_corrupt),
            'duplicate_images': len(c_dups),
            'unique_images': len(c_valid['md5'].unique()) if len(c_valid) > 0 else 0,
            'percentage_of_total': round(len(c_all) / total_files * 100, 2),
            'avg_width_px': round(c_valid['width'].mean(), 1) if len(c_valid) > 0 else 0,
            'avg_height_px': round(c_valid['height'].mean(), 1) if len(c_valid) > 0 else 0,
            'avg_file_size_kb': round(c_valid['file_size_kb'].mean(), 1) if len(c_valid) > 0 else 0,
        })

    class_metrics_df = pd.DataFrame(class_stats)
    class_metrics_csv_path = out_path / 'class_metrics.csv'
    class_metrics_df.to_csv(class_metrics_csv_path, index=False)
    print(f'Saved class metrics to: {class_metrics_csv_path}')

    color_mode_counts = valid_df['color_mode'].value_counts().to_dict()
    extension_counts = df['extension'].value_counts().to_dict()

    dim_stats = {
        'width': {
            'min': int(valid_df['width'].min()) if valid_count > 0 else 0,
            'max': int(valid_df['width'].max()) if valid_count > 0 else 0,
            'mean': round(float(valid_df['width'].mean()), 2) if valid_count > 0 else 0,
            'median': float(valid_df['width'].median()) if valid_count > 0 else 0,
            'std': round(float(valid_df['width'].std()), 2) if valid_count > 0 else 0,
        },
        'height': {
            'min': int(valid_df['height'].min()) if valid_count > 0 else 0,
            'max': int(valid_df['height'].max()) if valid_count > 0 else 0,
            'mean': round(float(valid_df['height'].mean()), 2) if valid_count > 0 else 0,
            'median': float(valid_df['height'].median()) if valid_count > 0 else 0,
            'std': round(float(valid_df['height'].std()), 2) if valid_count > 0 else 0,
        },
        'aspect_ratio': {
            'min': float(valid_df['aspect_ratio'].min()) if valid_count > 0 else 0,
            'max': float(valid_df['aspect_ratio'].max()) if valid_count > 0 else 0,
            'mean': round(float(valid_df['aspect_ratio'].mean()), 4) if valid_count > 0 else 0,
            'median': float(valid_df['aspect_ratio'].median()) if valid_count > 0 else 0,
        },
        'file_size_kb': {
            'min': float(valid_df['file_size_kb'].min()) if valid_count > 0 else 0,
            'max': float(valid_df['file_size_kb'].max()) if valid_count > 0 else 0,
            'mean': round(float(valid_df['file_size_kb'].mean()), 2) if valid_count > 0 else 0,
            'median': float(valid_df['file_size_kb'].median()) if valid_count > 0 else 0,
            'total_size_mb': round(float(valid_df['file_size_kb'].sum() / 1024.0), 2) if valid_count > 0 else 0,
        }
    }

    max_c = int(class_metrics_df['valid_images'].max())
    min_c = int(class_metrics_df['valid_images'].min())
    imbalance_ratio = round(max_c / min_c, 2) if min_c > 0 else 0

    summary = {
        'dataset_directory': str(dataset_path),
        'total_images_scanned': total_files,
        'valid_images': valid_count,
        'corrupted_images': len(corrupted_df),
        'exact_duplicate_files': num_duplicate_images,
        'redundant_duplicate_copies': num_redundant_copies,
        'cross_class_duplicates': len(cross_class_dups),
        'unique_images': num_unique_hashes,
        'total_classes': len(class_folders),
        'class_imbalance_ratio': imbalance_ratio,
        'color_modes': color_mode_counts,
        'file_extensions': extension_counts,
        'dimension_statistics': dim_stats,
    }

    summary_json_path = out_path / 'dataset_summary.json'
    with open(summary_json_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    print(f'Saved summary JSON to: {summary_json_path}')

    sns.set_theme(style='whitegrid')

    # Chart 1: Class distribution
    plt.figure(figsize=(12, 7))
    sorted_classes = class_metrics_df.sort_values('valid_images', ascending=True)
    bars = plt.barh(sorted_classes['class_name'], sorted_classes['valid_images'], color='#3B82F6', edgecolor='#1D4ED8')
    plt.xlabel('Number of Valid Images', fontsize=12, fontweight='bold')
    plt.title('Skin Disease Dataset - Class Distribution', fontsize=14, fontweight='bold', pad=15)
    for bar in bars:
        width = bar.get_width()
        plt.text(width + 80, bar.get_y() + bar.get_height()/2, f'{int(width):,} ({width/valid_count*100:.1f}%)',
                 va='center', ha='left', fontsize=9, fontweight='bold')
    plt.xlim(0, max_c * 1.22)
    plt.tight_layout()
    chart1_path = out_path / 'class_distribution.png'
    plt.savefig(chart1_path, dpi=300)
    plt.close()
    print(f'Generated chart: {chart1_path}')

    # Chart 2: Resolution & Aspect Ratio
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    sample_n = min(5000, len(valid_df))
    sns.scatterplot(data=valid_df.sample(sample_n, random_state=42),
                    x='width', y='height', hue='color_mode', alpha=0.5, ax=axes[0], palette='tab10')
    axes[0].set_title(f'Resolution Scatter (Sample {sample_n:,} Images)', fontsize=12, fontweight='bold')
    axes[0].set_xlabel('Width (pixels)')
    axes[0].set_ylabel('Height (pixels)')

    sns.histplot(data=valid_df, x='aspect_ratio', bins=40, kde=True, ax=axes[1], color='#10B981')
    axes[1].axvline(1.0, color='red', linestyle='--', label='1:1 Square')
    axes[1].set_title('Aspect Ratio Distribution', fontsize=12, fontweight='bold')
    axes[1].set_xlabel('Aspect Ratio (Width / Height)')
    axes[1].legend()

    plt.tight_layout()
    chart2_path = out_path / 'resolution_and_aspect_ratio.png'
    plt.savefig(chart2_path, dpi=300)
    plt.close()
    print(f'Generated chart: {chart2_path}')

    # Chart 3: Color modes
    plt.figure(figsize=(8, 6))
    modes = list(color_mode_counts.keys())
    counts = list(color_mode_counts.values())
    colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][:len(modes)]
    plt.pie(counts, labels=[f'{m} ({c:,})' for m, c in zip(modes, counts)],
            autopct='%1.1f%%', colors=colors, startangle=140,
            wedgeprops=dict(width=0.6, edgecolor='w', linewidth=2))
    plt.title('Color Mode Distribution', fontsize=13, fontweight='bold')
    plt.tight_layout()
    chart3_path = out_path / 'color_mode_distribution.png'
    plt.savefig(chart3_path, dpi=300)
    plt.close()
    print(f'Generated chart: {chart3_path}')

    # Markdown report
    lines = []
    lines.append('# Dataset Quality & Exploratory Data Analysis Report\n')
    lines.append('**Project**: An AI-Based Transformer for Real-Time Skin Disease Classification')
    lines.append(f'**Dataset Path**: `{dataset_dir}`\n')
    lines.append('## 1. Summary Metrics\n')
    lines.append('| Metric | Value |')
    lines.append('| :--- | :--- |')
    lines.append(f'| Total Images Scanned | **{total_files:,}** |')
    lines.append(f'| Valid Readable Images | **{valid_count:,} ({valid_count/total_files*100:.2f}%)** |')
    lines.append(f'| Corrupted / Unreadable | **{len(corrupted_df):,}** |')
    lines.append(f'| Classes Count | **{len(class_folders)}** |')
    lines.append(f'| Duplicate Image Files | **{num_duplicate_images:,}** ({num_redundant_copies:,} redundant) |')
    lines.append(f'| Cross-Class Duplicates | **{len(cross_class_dups):,}** |')
    lines.append(f'| Unique Image Hashes | **{num_unique_hashes:,}** |')
    lines.append(f'| Imbalance Ratio | **{imbalance_ratio:.2f}:1** |')
    lines.append(f'| Total Disk Size | **{dim_stats["file_size_kb"]["total_size_mb"]:.1f} MB** |\n')
    lines.append('## 2. Per-Class Statistics\n')
    lines.append('| # | Class Name | Total Files | Valid | Corrupted | Duplicates | % Share | Avg Size (W x H) |')
    lines.append('| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |')
    for idx, row in class_metrics_df.iterrows():
        lines.append(f'| {idx+1} | `{row["class_name"]}` | {row["total_files"]:,} | {row["valid_images"]:,} | {row["corrupted_images"]} | {row["duplicate_images"]:,} | {row["percentage_of_total"]}% | {int(row["avg_width_px"])} x {int(row["avg_height_px"])} px |')

    lines.append('\n## 3. Dimensions & Color Modes\n')
    lines.append(f'- **Width (px)**: Min={dim_stats["width"]["min"]}, Max={dim_stats["width"]["max"]}, Mean={dim_stats["width"]["mean"]}, Median={dim_stats["width"]["median"]}')
    lines.append(f'- **Height (px)**: Min={dim_stats["height"]["min"]}, Max={dim_stats["height"]["max"]}, Mean={dim_stats["height"]["mean"]}, Median={dim_stats["height"]["median"]}')
    lines.append(f'- **Aspect Ratio**: Mean={dim_stats["aspect_ratio"]["mean"]}, Median={dim_stats["aspect_ratio"]["median"]}')
    lines.append('- **Color Modes**:' + ', '.join([f' {k}: {v:,}' for k, v in color_mode_counts.items()]))
    lines.append('- **Extensions**:' + ', '.join([f' {k}: {v:,}' for k, v in extension_counts.items()]))

    report_md_path = out_path / 'dataset_analysis_report.md'
    with open(report_md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'Saved Markdown report to: {report_md_path}')
    print('=' * 65)
    print('Analysis Complete!')
    print('=' * 65)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze Skin Disease Dataset")
    parser.add_argument("--dataset_dir", type=str, default=r"Z:\ALL\IMG_CLASSES")
    parser.add_argument("--output_dir", type=str, default=r"reports/dataset_analysis")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    run_analysis(args.dataset_dir, args.output_dir, args.workers)
