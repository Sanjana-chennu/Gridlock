"""
vyuha/plate_detector.py
========================
Plate detection via subprocess isolation.
EasyOCR + OpenCV run in a child process so a crash never kills Streamlit.
"""
from __future__ import annotations
import io, json, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKER = os.path.join(ROOT, "vyuha", "run_detection.py")
VENV_PYTHON = os.path.join(ROOT, "venv", "bin", "python")
PYTHON = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable


def _draw_bbox(pil_img: Image.Image, bbox, label: str,
               color=(0, 230, 90)) -> Image.Image:
    out  = pil_img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)
    x1, y1, x2, y2 = [int(v) for v in bbox]
    lw = max(3, int(min(out.width, out.height) * 0.005))
    draw.rectangle([x1, y1, x2, y2], outline=color, width=lw)
    tw = 9 * max(len(label), 1); th = 18
    draw.rectangle([x1, max(0, y1 - th - 4), x1 + tw + 8, y1], fill=color)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
    except Exception:
        font = ImageFont.load_default()
    draw.text((x1 + 4, max(0, y1 - th - 1)), label, fill=(0, 0, 0), font=font)
    return out


def detect_plate(image, timeout: int = 60) -> dict:
    """
    Detect licence plate by running the worker script in a subprocess.
    Never raises — returns an error dict on failure.
    """
    # Normalise to PIL
    if isinstance(image, (bytes, bytearray)):
        image = Image.open(io.BytesIO(image))
    pil_img = image.convert("RGB") if isinstance(image, Image.Image) else Image.fromarray(image)

    # Save to a temp file the subprocess can read
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
        pil_img.save(tmp_path, "JPEG", quality=92)

    try:
        result = subprocess.run(
            [PYTHON, WORKER, tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if not stdout:
            return {"plate_text": "", "confidence_det": 0.0, "confidence_ocr": 0.0,
                    "bbox": [], "annotated_image": pil_img, "plate_crop": None,
                    "method": "failed",
                    "error": f"Worker produced no output. stderr: {stderr[:300]}"}

        data = json.loads(stdout)
        plate_text = data.get("plate_text", "")
        bbox       = data.get("bbox", [])
        ocr_conf   = data.get("confidence_ocr", 0.0)
        method     = data.get("method", "unknown")
        error      = data.get("error")
        photo_audit = data.get("photo_audit", {
            "blur_score": 120.0, "blur_passed": True,
            "contrast_score": 45.0, "contrast_passed": True,
            "focus_ratio": 1.2, "focus_passed": True
        })

        # Annotate original image
        annotated = pil_img
        crop = None
        if bbox and len(bbox) == 4:
            x1, y1, x2, y2 = bbox
            crop_arr = pil_img.crop((x1, y1, x2, y2))
            crop = crop_arr
            color_map = {
                "opencv":        (0, 220, 80),
                "pil":           (100, 160, 255),
                "fullscan":      (250, 160, 0),
                "fallback_strip":(180, 100, 255),
            }
            color = color_map.get(method, (200, 200, 200))
            lbl = f"{plate_text}  ({method})" if plate_text else method
            annotated = _draw_bbox(pil_img, bbox, lbl, color)

        return {
            "plate_text":      plate_text,
            "confidence_det":  0.80 if bbox else 0.0,
            "confidence_ocr":  ocr_conf,
            "bbox":            bbox,
            "annotated_image": annotated,
            "plate_crop":      crop,
            "method":          method,
            "error":           error,
            "photo_audit":     photo_audit
        }

    except subprocess.TimeoutExpired:
        return {"plate_text": "", "confidence_det": 0.0, "confidence_ocr": 0.0,
                "bbox": [], "annotated_image": pil_img, "plate_crop": None,
                "method": "timeout",
                "error": f"Detection timed out after {timeout}s",
                "photo_audit": {"blur_score": 0.0, "blur_passed": False, "contrast_score": 0.0, "contrast_passed": False, "focus_ratio": 0.0, "focus_passed": False}}
    except json.JSONDecodeError as e:
        return {"plate_text": "", "confidence_det": 0.0, "confidence_ocr": 0.0,
                "bbox": [], "annotated_image": pil_img, "plate_crop": None,
                "method": "failed",
                "error": f"JSON parse error: {e}",
                "photo_audit": {"blur_score": 0.0, "blur_passed": False, "contrast_score": 0.0, "contrast_passed": False, "focus_ratio": 0.0, "focus_passed": False}}
    except Exception as e:
        return {"plate_text": "", "confidence_det": 0.0, "confidence_ocr": 0.0,
                "bbox": [], "annotated_image": pil_img, "plate_crop": None,
                "method": "failed", "error": str(e)}
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
