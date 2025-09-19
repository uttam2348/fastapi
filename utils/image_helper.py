import os
import aiofiles
from PIL import Image
from typing import Tuple
import uuid

UPLOAD_DIR = "uploads"
COMPRESSED_DIR = "uploads/compressed"

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(COMPRESSED_DIR, exist_ok=True)

async def save_and_compress_image(file, filename: str, max_size: Tuple[int, int] = (800, 600), quality: int = 85) -> str:
    """
    Save uploaded image and create a compressed version
    Returns the path to the compressed image
    """
    # Generate unique filename
    file_extension = os.path.splitext(filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    original_path = os.path.join(UPLOAD_DIR, unique_filename)
    compressed_path = os.path.join(COMPRESSED_DIR, unique_filename)

    # Save original file
    async with aiofiles.open(original_path, 'wb') as f:
        content = await file.read()
        await f.write(content)

    # Compress image
    try:
        with Image.open(original_path) as img:
            # Convert to RGB if necessary
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Resize if larger than max_size
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)

            # Save compressed version
            img.save(compressed_path, 'JPEG', quality=quality, optimize=True)

        return compressed_path

    except Exception as e:
        print(f"Image compression error: {e}")
        # Return original path if compression fails
        return original_path

def get_image_path(filename: str, compressed: bool = True) -> str:
    """Get the path to an image file"""
    if compressed:
        return os.path.join(COMPRESSED_DIR, filename)
    return os.path.join(UPLOAD_DIR, filename)

def cleanup_old_images(max_age_days: int = 30):
    """Clean up old uploaded images (optional maintenance function)"""
    import time
    import glob

    current_time = time.time()
    max_age = max_age_days * 24 * 60 * 60

    for directory in [UPLOAD_DIR, COMPRESSED_DIR]:
        for filepath in glob.glob(os.path.join(directory, '*')):
            if os.path.isfile(filepath):
                file_age = current_time - os.path.getmtime(filepath)
                if file_age > max_age:
                    try:
                        os.remove(filepath)
                        print(f"Cleaned up old image: {filepath}")
                    except Exception as e:
                        print(f"Error cleaning up {filepath}: {e}")