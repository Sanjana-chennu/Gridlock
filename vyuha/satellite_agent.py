"""
Vyuha Satellite Agent
Uses MapMyIndia (Mappls) APIs to:
  1. Fetch static satellite map image of a DFS-flagged zone
  2. Query nearby POIs (metro, hospital, commercial) for context
  3. Pass image + violation data + POI context to Gemini Vision
  4. Generate a grounded, specific BBMP infrastructure proposal

Requires:
  MAPPLS_API_KEY = your MapMyIndia REST key
  GEMINI_API_KEY = your Gemini API key
"""

import os
import io
from typing import Optional, List
import requests
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

MAPPLS_KEY  = os.getenv("MAPPLS_API_KEY", "")
GEMINI_KEY  = os.getenv("GEMINI_API_KEY", "")

# MapMyIndia API endpoints
STILL_MAP_URL = "https://tile.mappls.com/map/raster_tile/still_image"
NEARBY_URL    = "https://search.mappls.com/search/places/nearby/json"

# POI categories relevant to parking enforcement
POI_KEYWORDS = ["metro station", "bus stop", "hospital", "school", "mall", "market", "petrol pump"]


def fetch_free_satellite_image(lat: float, lng: float, zoom: int = 17) -> Optional[bytes]:
    """
    Fetch and stitch satellite tiles from Esri World Imagery (free, keyless).
    Crops the image so the target lat/lng is exactly in the center.
    Returns JPEG bytes or None.
    """
    import math
    import io
    try:
        # Convert lat/lng to fractional tile coordinates
        lat_rad = math.radians(lat)
        n = 2.0 ** zoom
        fx = (lng + 180.0) / 360.0 * n
        fy = (1.0 - math.log(math.tan(lat_rad) + (1.0 / math.cos(lat_rad))) / math.pi) / 2.0 * n

        x = int(fx)
        y = int(fy)
        dx = fx - x
        dy = fy - y

        # Create a blank 768x768 canvas (3x3 grid of 256x256 tiles)
        canvas = Image.new("RGB", (768, 768))

        # Download and paste tiles
        headers = {"User-Agent": "Mozilla/5.0"}
        for i, col in enumerate([x - 1, x, x + 1]):
            for j, row in enumerate([y - 1, y, y + 1]):
                url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{row}/{col}"
                resp = requests.get(url, headers=headers, timeout=5)
                if resp.status_code == 200:
                    tile = Image.open(io.BytesIO(resp.content))
                    canvas.paste(tile, (i * 256, j * 256))

        # Calculate exact pixel position of the lat/lng on the canvas
        px = 256 + 256 * dx
        py = 256 + 256 * dy

        # Crop a 512x512 box centered at (px, py)
        cropped = canvas.crop((int(px - 256), int(py - 256), int(px + 256), int(py + 256)))
        
        # Save to bytes
        out_buf = io.BytesIO()
        cropped.save(out_buf, format="JPEG")
        return out_buf.getvalue()

    except Exception as e:
        print(f"⚠️  Free satellite tile fetch failed: {e}")
        return None


def fetch_satellite_image(lat: float, lng: float, zoom: int = 17, size: str = "640x640") -> Optional[bytes]:
    """
    Fetch satellite map image.
    First tries Mappls Still Map Image API.
    Falls back to a free public Esri World Imagery tile-stitching service if Mappls fails/unauthorized.
    """
    if MAPPLS_KEY and MAPPLS_KEY != "your_mappls_api_key_here":
        params = {
            "center":       f"{lat},{lng}",
            "zoom":         zoom,
            "size":         size,
            "access_token": MAPPLS_KEY,
        }
        try:
            resp = requests.get(STILL_MAP_URL, params=params, timeout=10)
            if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                print("✅  Successfully fetched satellite image from Mappls")
                return resp.content
            else:
                print(f"⚠️  Mappls Still Map API returned {resp.status_code}. Falling back to free satellite tiles...")
        except Exception as e:
            print(f"⚠️  Mappls Still Map API failed: {e}. Falling back to free satellite tiles...")
    else:
        print("ℹ️  Mappls API key not set or invalid. Falling back to free satellite tiles...")

    # Fallback: Stitch public Esri World Imagery tiles (keyless & free)
    return fetch_free_satellite_image(lat, lng, zoom=17)


def fetch_nearby_pois(lat: float, lng: float, radius_m: int = 500) -> List[dict]:
    """
    Fetch nearby POIs from Mappls Nearby API.
    Returns list of {name, type, distance} dicts.
    """
    if not MAPPLS_KEY:
        return []

    pois = []
    for keyword in POI_KEYWORDS[:4]:  # limit API calls
        try:
            params = {
                "refLocation":  f"{lat},{lng}",
                "keywords":     keyword,
                "access_token": MAPPLS_KEY,
            }
            resp = requests.get(NEARBY_URL, params=params, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                places = data.get("suggestedLocations", []) or data.get("results", [])
                for p in places[:2]:  # top 2 per category
                    name = p.get("placeName") or p.get("name", keyword)
                    dist = p.get("distance", "?")
                    pois.append({"name": name, "type": keyword, "distance": dist})
        except Exception:
            pass
    return pois


def build_vision_prompt(zone_name: str, zone_stats: dict, pois: list[dict]) -> str:
    """Build a detailed prompt for Gemini Vision based on zone data + nearby POIs."""
    poi_text = ""
    if pois:
        poi_lines = "\n".join(f"  - {p['name']} ({p['type']}, ~{p['distance']}m away)" for p in pois)
        poi_text  = f"\n\nNearby infrastructure (from Mappls API):\n{poi_lines}"

    dist_text = ""
    dist = zone_stats.get("violation_distribution", {})
    if dist:
        dist_lines = "\n".join(f"  - {k}: {v}%" for k, v in dist.items())
        dist_text = f"\n\nHistorical BTP Violation Distribution:\n{dist_lines}"

    return f"""You are a BBMP (Bruhat Bengaluru Mahanagara Palike) civic infrastructure analyst.

You are analyzing "{zone_name}" in Bengaluru, India.

Violation data for this zone:
- DFS Score: {zone_stats.get('dfs_score', 'N/A')}/100 (Enforcement-Resistant)
- Consecutive enforcement-resistant weeks: {zone_stats.get('max_streak_wks', 'N/A')}
- Average weekly violations: {zone_stats.get('avg_weekly_violations', 'N/A')}
- Average weekly enforcement visits: {zone_stats.get('avg_enforcement', 'N/A')}
- Trend: {zone_stats.get('improvement_status', 'Stagnant')} (violation slope: {zone_stats.get('violation_slope', 0):.2f}/week)
- Zone type: {zone_stats.get('zone_type', 'arterial')}{dist_text}{poi_text}

Instructions for analysis:
1. If a satellite image is provided, examine it to identify road features, sidewalks, obstacles, and informal parking.
2. If no satellite image is provided (or if the image load failed), perform a data-driven structural assessment based entirely on the POI context and the "Historical BTP Violation Distribution" listed above.

Tailor your recommended physical interventions directly to the predominant offense types observed in the data:
- For high 'PARKING ON FOOTPATH' or sidewalk offenses: Propose bollard installation, elevated curbs, and footpath widening.
- For high 'WRONG PARKING', 'NO PARKING', or 'PARKING IN A MAIN ROAD': Propose designated loading/unloading bays, parallel parking slots (demarcated with paint), or vertical regulatory signage.
- For high 'PARKING NEAR BUS STOP' or 'PARKING NEAR ROAD CROSSING' (like PARKING NEAR JUNCTION/SIGNAL): Propose bus bay extensions, junction corner clearance (bulb-outs), or road markings like yellow grid boxes.
- For non-parking violations (like number plate or helmet violations): Propose street lighting upgrades and ANPR camera mounts.

Based on this analysis, write a formal BBMP Infrastructure Intervention Brief in markdown. Include:

## BBMP Infrastructure Intervention Brief

**Zone:** [zone name and coordinates]
**Classification:** Enforcement-Resistant
**DFS Score:** [score]/100

### Civic & Data-Driven Assessment
[Your assessment. If satellite image is present, describe visual features. If not, describe the structural layout inferred from the POI context and the BTP offense distribution (e.g., explaining why the high percentage of specific offenses aligns with the nearby POIs)]

### Root Cause Analysis
[Why police enforcement cannot fix this structurally — reference the numbers and explain how the dominant offence types are caused by structural gaps, e.g. lack of parking or barriers]

### Recommended Physical Interventions
[3-4 specific, costed interventions tailored directly to the dominant offence types and nearby POIs]
For each: Name | Specific location / justification | Estimated cost (INR) | Expected violation reduction

### Expected Outcome
[Quantified expected improvement with timeline]

Be specific — reference the actual BTP offense types and percentages.
Keep total length under 500 words."""


def generate_satellite_proposal(
    lat: float,
    lng: float,
    zone_name: str,
    zone_stats: dict,
) -> dict:
    """
    Full pipeline:
    1. Fetch satellite image via Mappls
    2. Fetch nearby POIs via Mappls
    3. Analyse with Gemini Vision
    4. Return structured proposal

    Returns dict with: proposal_text, image_bytes, pois, source
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")

    if not groq_key and not gemini_key:
        return {
            "proposal": _fallback_proposal(zone_name, zone_stats),
            "image_bytes": None,
            "pois": [],
            "source": "fallback_no_api_key",
        }

    # Step 1: Satellite image
    print(f"  📡 Fetching satellite image for {zone_name} ({lat:.4f}, {lng:.4f})...")
    image_bytes = fetch_satellite_image(lat, lng, zoom=18)

    # Step 2: Nearby POIs
    print(f"  🗺️  Fetching nearby POIs...")
    pois = fetch_nearby_pois(lat, lng)
    if pois:
        print(f"      Found {len(pois)} POIs: {', '.join(p['type'] for p in pois[:3])}")

    # Step 3: Analyse with Groq if available
    if groq_key:
        try:
            import base64
            prompt = build_vision_prompt(zone_name, zone_stats, pois)
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            if image_bytes:
                img_b64 = base64.b64encode(image_bytes).decode("utf-8")
                model = "llama-3.2-11b-vision-preview"
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                        ]
                    }
                ]
                print(f"  🤖 Sending satellite image to Groq Vision ({model})...")
            else:
                model = "llama-3.3-70b-versatile"
                messages = [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
                print(f"  🤖 No image — using Groq text mode ({model})...")

            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.2
            }
            url = "https://api.groq.com/openai/v1/chat/completions"
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code == 200:
                res_data = resp.json()
                proposal_text = res_data["choices"][0]["message"]["content"]
                return {
                    "proposal":    proposal_text,
                    "image_bytes": image_bytes,
                    "pois":        pois,
                    "source":      f"groq_{model}",
                }
            else:
                print(f"  ⚠️  Groq API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"  ⚠️  Groq call failed: {e}")

    # Step 4: Fallback to Gemini if Groq failed or unconfigured
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model  = genai.GenerativeModel("gemini-2.5-flash")
            prompt = build_vision_prompt(zone_name, zone_stats, pois)

            if image_bytes:
                # Vision mode — analyse actual satellite image
                print(f"  🤖 Sending satellite image to Gemini Vision...")
                image = Image.open(io.BytesIO(image_bytes))
                response = model.generate_content([prompt, image])
                source = "gemini_vision_mappls"
            else:
                # Text-only mode — use zone data + POIs only
                print(f"  🤖 No image — using Gemini text mode with POI context...")
                response = model.generate_content(prompt)
                source = "gemini_text_mappls_pois"

            return {
                "proposal":    response.text,
                "image_bytes": image_bytes,
                "pois":        pois,
                "source":      source,
            }
        except Exception as e:
            print(f"  ⚠️  Gemini call failed: {e}")

    # Final fallback if all failed
    return {
        "proposal":    _fallback_proposal(zone_name, zone_stats),
        "image_bytes": image_bytes,
        "pois":        pois,
        "source":      "fallback_api_error",
    }


def _fallback_proposal(zone_name: str, zone_stats: dict) -> str:
    """Pre-written fallback when APIs are unavailable."""
    dist = zone_stats.get("violation_distribution", {})
    dist_text = ""
    if dist:
        dist_text = "\nTop Violation Types:\n" + "\n".join(f"- {k}: {v}%" for k, v in list(dist.items())[:3])

    return f"""## BBMP Infrastructure Intervention Brief

**Zone:** {zone_name}
**DFS Score:** {zone_stats.get('dfs_score', 'N/A')}/100 — Enforcement-Resistant
**Trend:** {zone_stats.get('improvement_status', 'Stagnant')}
{dist_text}

### Root Cause Analysis
{zone_stats.get('max_streak_wks', '?')} consecutive weeks of high violations ({zone_stats.get('avg_weekly_violations', '?')}/week avg) despite {zone_stats.get('avg_enforcement', '?')} enforcement visits/week. Police presence has **zero sustained suppression effect** — this is a structural deficiency.

### Recommended Physical Interventions
1. **Perimeter bollard installation** — ₹3–4L — prevents carriageway encroachment (est. 35% violation reduction)
2. **Designated loading/unloading bay** — ₹1.5L — eliminates double-parking during peak commercial hours
3. **Junction marking refresh** — ₹40K — restores visual deterrence at intersection
4. **Transit feeder bay** — ₹80K — reduces unregulated drop-off congestion

### Expected Outcome
55–65% violation reduction within 8 weeks. Frees ~5 officer patrol-hours/week at this location.

*Note: Add MAPPLS_API_KEY + GEMINI_API_KEY to .env for satellite vision analysis.*"""


if __name__ == "__main__":
    # Quick test
    result = generate_satellite_proposal(
        lat=12.9565, lng=77.7006,
        zone_name="Marathahalli Bridge",
        zone_stats={
            "dfs_score": 96.4, "max_streak_wks": 24,
            "avg_weekly_violations": 34.2, "avg_enforcement": 5.1,
            "zone_type": "intersection", "improvement_status": "Stagnant",
            "violation_slope": 0.05,
            "violation_distribution": {
                "WRONG PARKING": 54.2,
                "PARKING ON FOOTPATH": 28.5,
                "PARKING NEAR BUS STOP": 12.3,
                "DEFECTIVE NUMBER PLATE": 5.0
            }
        }
    )
    print(f"\nSource: {result['source']}")
    print(f"POIs found: {len(result['pois'])}")
    print(f"Image fetched: {'Yes' if result['image_bytes'] else 'No'}")
    print("\n" + result["proposal"])
