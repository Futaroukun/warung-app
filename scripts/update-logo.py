#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw

SRC_LOGO = '/sdcard/bmsq/IMG_20261005_194252.png'
APP_ROOT = '/data/data/com.termux/files/home/warung-app'

if not os.path.exists(SRC_LOGO):
    print(f"Error: {SRC_LOGO} not found")
    exit(1)

src = Image.open(SRC_LOGO).convert('RGBA')

# 1. Update public/icon.png (512x512)
icon_512 = src.resize((512, 512), Image.Resampling.LANCZOS)
dest_public_icon = os.path.join(APP_ROOT, 'public/icon.png')
icon_512.save(dest_public_icon, format='PNG')
print(f"✓ Saved 512x512 PWA/Web icon: {dest_public_icon}")

# 2. Function to generate circular round icon
def make_round(img):
    size = img.size
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0], size[1]), fill=255)
    
    round_img = Image.new('RGBA', size, (0, 0, 0, 0))
    round_img.paste(img, (0, 0), mask=mask)
    return round_img

# 3. Android Mipmap densities
densities = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

res_dir = os.path.join(APP_ROOT, 'android/app/src/main/res')

for folder, size in densities.items():
    target_dir = os.path.join(res_dir, folder)
    os.makedirs(target_dir, exist_ok=True)
    
    # Square / standard icon
    resized = src.resize((size, size), Image.Resampling.LANCZOS)
    square_path = os.path.join(target_dir, 'ic_launcher.png')
    resized.save(square_path, format='PNG')
    
    # Round icon
    round_icon = make_round(resized)
    round_path = os.path.join(target_dir, 'ic_launcher_round.png')
    round_icon.save(round_path, format='PNG')
    
    print(f"✓ Generated {folder} ({size}x{size}): ic_launcher.png & ic_launcher_round.png")

print("✓ All Android and Web icons updated successfully!")
