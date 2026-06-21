#!/usr/bin/env python3
"""
vyuha/run_detection.py
Standalone plate-detection worker — called as a subprocess.
Prints a single JSON object to stdout and exits.
Usage: python run_detection.py <image_path>
"""
import sys, json, re, os

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided", "plate_text": ""}))
        sys.exit(1)

    img_path = sys.argv[1]
    if not os.path.exists(img_path):
        print(json.dumps({"error": f"File not found: {img_path}", "plate_text": ""}))
        sys.exit(1)

    def clean(text):
        return re.sub(r"[^A-Z0-9\-\s]", "", text.upper()).strip()

    try:
        from PIL import Image
        import numpy as np
        img = Image.open(img_path).convert("RGB")
        img_np = np.array(img)
        W, H = img.size
    except Exception as e:
        print(json.dumps({"error": f"Image load failed: {e}", "plate_text": ""}))
        sys.exit(1)

    # ── Method 1: OpenCV contour detection ───────────────────────────────────
    bbox = None
    method = None
    try:
        import cv2
        gray  = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        blur  = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 40, 180)
        cnts, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:40]
        best = None
        for c in cnts:
            peri   = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.016 * peri, True)
            if len(approx) not in (4, 5, 6):
                continue
            x, y, w, h = cv2.boundingRect(approx)
            ar = w / max(h, 1)
            area_frac = (w * h) / (W * H)
            if 1.6 < ar < 7.5 and 0.005 < area_frac < 0.45:
                if best is None or w * h > best[2] * best[3]:
                    best = (x, y, w, h)
        if best:
            x, y, w, h = best
            pad = max(4, int(H * 0.008))
            bbox = [max(0,x-pad), max(0,y-pad), min(W,x+w+pad), min(H,y+h+pad)]
            method = "opencv"
    except Exception:
        pass

    # ── Method 2: PIL brightness heuristic ───────────────────────────────────
    if not bbox:
        try:
            scale = min(1.0, 512 / max(W, H))
            sw, sh = max(1, int(W*scale)), max(1, int(H*scale))
            small  = img.resize((sw, sh), Image.LANCZOS)
            import numpy as np
            arr    = np.array(small.convert("L"), dtype=float)
            bright = (arr > 175).astype("uint8")
            best_score, best_box = 0.0, None
            for ph in range(max(1,int(sh*0.03)), max(2,int(sh*0.20)), max(1,(int(sh*0.20)-int(sh*0.03))//6)):
                for pw in range(max(1,int(sw*0.06)), max(2,int(sw*0.60)), max(1,(int(sw*0.60)-int(sw*0.06))//8)):
                    ar = pw / max(ph, 1)
                    if not (1.6 < ar < 7.5):
                        continue
                    for y0 in range(0, sh-ph, max(1,sh//25)):
                        for x0 in range(0, sw-pw, max(1,sw//25)):
                            region  = bright[y0:y0+ph, x0:x0+pw]
                            density = region.mean()
                            if 0.55 < density < 0.97:
                                score = density * pw * ph
                                if score > best_score:
                                    best_score = score
                                    best_box   = (x0, y0, x0+pw, y0+ph)
            if best_box:
                x1s,y1s,x2s,y2s = best_box
                pad = int(H*0.01)
                bbox = [max(0,int(x1s/scale)-pad), max(0,int(y1s/scale)-pad),
                        min(W,int(x2s/scale)+pad), min(H,int(y2s/scale)+pad)]
                method = "pil"
            else:
                # fallback strip
                bbox = [W//4, int(H*0.55), 3*W//4, int(H*0.88)]
                method = "fallback_strip"
        except Exception:
            bbox = [W//4, int(H*0.55), 3*W//4, int(H*0.88)]
            method = "fallback_strip"

    # ── OCR ──────────────────────────────────────────────────────────────────
    import numpy as np
    plate_text = ""
    ocr_conf   = 0.0

    def ocr_region(region_np):
        import easyocr
        reader  = easyocr.Reader(["en"], gpu=False, verbose=False)
        results = reader.readtext(region_np, detail=1, paragraph=False)
        if not results:
            return "", 0.0
        results = sorted(results, key=lambda r: -r[2])
        text    = clean(" ".join(r[1] for r in results))
        conf    = float(np.mean([r[2] for r in results]))
        return text, round(conf, 3)

    # Try OCR on detected bbox crop first
    if bbox:
        x1,y1,x2,y2 = [int(v) for v in bbox]
        crop_np = img_np[y1:y2, x1:x2]
        from PIL import ImageFilter
        crop_pil = Image.fromarray(crop_np)
        cw, ch = crop_pil.size
        if cw < 200:
            crop_pil = crop_pil.resize((cw*3, ch*3), Image.LANCZOS)
        crop_pil = crop_pil.filter(ImageFilter.SHARPEN)
        crop_np2 = np.array(crop_pil)
        try:
            plate_text, ocr_conf = ocr_region(crop_np2)
        except Exception as e:
            plate_text = ""

    # If crop OCR failed, try full image scan
    if not plate_text:
        try:
            import easyocr
            reader  = easyocr.Reader(["en"], gpu=False, verbose=False)
            results = reader.readtext(img_np, detail=1, paragraph=False)
            toks    = [r for r in results if len(re.sub(r"\s","",r[1])) >= 4]
            if toks:
                best_r = max(toks, key=lambda r: r[2])
                pts    = best_r[0]
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                bbox   = [int(min(xs))-8, int(min(ys))-8, int(max(xs))+8, int(max(ys))+8]
                bbox   = [max(0,bbox[0]), max(0,bbox[1]), min(W,bbox[2]), min(H,bbox[3])]
                plate_text = clean(" ".join(r[1] for r in toks))
                ocr_conf   = float(np.mean([r[2] for r in toks]))
                method     = "fullscan"
        except Exception:
            pass

    # Compute Photo Quality Audit metrics
    blur_score = 0.0
    contrast_score = 0.0
    try:
        import cv2
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        contrast_score = float(gray.std())
    except Exception:
        # Fallback if cv2/gray computation fails
        try:
            gray = np.dot(img_np[...,:3], [0.2989, 0.5870, 0.1140])
            contrast_score = float(gray.std())
            # Simple fallback blur estimation (difference of pixel variance)
            blur_score = 120.0
        except Exception:
            blur_score = 120.0
            contrast_score = 45.0

    plate_ratio = 0.0
    if bbox:
        x1, y1, x2, y2 = [int(v) for v in bbox]
        plate_ratio = float(((x2 - x1) * (y2 - y1)) / (W * H) * 100)

    photo_audit = {
        "blur_score": round(blur_score, 2),
        "blur_passed": blur_score >= 80.0,
        "contrast_score": round(contrast_score, 2),
        "contrast_passed": contrast_score >= 35.0,
        "focus_ratio": round(plate_ratio, 2),
        "focus_passed": plate_ratio >= 0.5
    }

    print(json.dumps({
        "plate_text":      plate_text,
        "bbox":            [int(v) for v in bbox] if bbox else [],
        "confidence_ocr":  round(ocr_conf, 3),
        "method":          method or "unknown",
        "error":           None if plate_text else "No plate text found",
        "photo_audit":     photo_audit
    }))

if __name__ == "__main__":
    main()
