#!/usr/bin/env python3
"""
OWASP Suppressions Policy Validator
====================================
Mechanically validates .github/owasp-suppressions.xml to ensure compliance with
Medbuilds EMR Security Governance:
  1. Every <suppress> tag MUST have an 'until' attribute with format YYYY-MM-DD.
  2. The 'until' date MUST NOT be in the past (expired suppressions are rejected).
  3. The 'until' date MUST NOT exceed 90 days into the future.
  4. The <notes> element MUST include:
     - 'ISSUE:' or GitHub issue URL reference
     - 'Reviewed by:' indicating dual reviewer handles
     - 'RATIONALE:' documenting why the CVE is not exploitable in Medbuilds EMR
  5. The <cve> or vulnerability identifier element MUST be present and non-empty.

Usage:
  python3 .github/scripts/validate-suppressions.py [.github/owasp-suppressions.xml]
"""

import sys
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

MAX_SUPPRESSION_DAYS = 90

def validate_suppressions(file_path: str) -> int:
    if not os.path.exists(file_path):
        print(f"[ERROR] Suppressions file not found: {file_path}")
        return 1

    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"[ERROR] XML Parse Error in {file_path}: {e}")
        return 1

    # Extract all <suppress> elements regardless of XML namespace
    suppress_elements = []
    for elem in root.iter():
        tag_name = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        if tag_name == 'suppress':
            suppress_elements.append(elem)

    if not suppress_elements:
        print(f"[OK] No active suppressions in {file_path}. Clean baseline confirmed.")
        return 0

    print(f"[INFO] Validating {len(suppress_elements)} suppression entry/entries in {file_path}...")

    today = datetime.now(timezone.utc).date()
    max_allowed_date = today + timedelta(days=MAX_SUPPRESSION_DAYS)
    errors = []

    for idx, elem in enumerate(suppress_elements, start=1):
        entry_desc = f"Suppression entry #{idx}"
        cve_elem = None
        notes_elem = None

        for child in elem:
            child_tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if child_tag in ('cve', 'vulnerabilityName'):
                cve_elem = child
            elif child_tag == 'notes':
                notes_elem = child

        cve_id = cve_elem.text.strip() if (cve_elem is not None and cve_elem.text) else "UNKNOWN_CVE"
        entry_desc = f"Suppression entry #{idx} [{cve_id}]"

        # 1. Check 'until' attribute presence
        until_attr = elem.attrib.get('until')
        if not until_attr:
            errors.append(f"{entry_desc}: Missing mandatory 'until' attribute. Format must be YYYY-MM-DD.")
            continue

        # 2. Check 'until' date format
        try:
            until_date = datetime.strptime(until_attr.strip(), "%Y-%m-%d").date()
        except ValueError:
            errors.append(f"{entry_desc}: Invalid 'until' date format '{until_attr}'. Expected YYYY-MM-DD.")
            continue

        # 3. Check expiration (must not be in the past)
        if until_date < today:
            errors.append(
                f"{entry_desc}: Expired on {until_date} (today is {today}). "
                "Expired suppressions must be removed or formally renewed."
            )

        # 4. Check 90-day window limit
        if until_date > max_allowed_date:
            days_out = (until_date - today).days
            errors.append(
                f"{entry_desc}: Expiry date {until_date} is {days_out} days in the future. "
                f"Maximum permitted suppression duration is {MAX_SUPPRESSION_DAYS} days (until {max_allowed_date})."
            )

        # 5. Check <notes> metadata requirements
        if notes_elem is None or not (notes_elem.text and notes_elem.text.strip()):
            errors.append(f"{entry_desc}: Missing mandatory <notes> justification block.")
        else:
            notes_text = notes_elem.text.strip()
            if len(notes_text) < 30:
                errors.append(f"{entry_desc}: <notes> block is too short ({len(notes_text)} chars). Detailed explanation required.")

            if not ("ISSUE:" in notes_text or "github.com" in notes_text):
                errors.append(f"{entry_desc}: <notes> must reference tracking issue ('ISSUE:' or GitHub issue URL).")

            if not ("Reviewed by:" in notes_text or "reviewed by" in notes_text.lower()):
                errors.append(f"{entry_desc}: <notes> must list dual security reviewer handles ('Reviewed by: @user1, @user2').")

            if not ("RATIONALE:" in notes_text or "rationale" in notes_text.lower()):
                errors.append(f"{entry_desc}: <notes> must provide detailed justification ('RATIONALE: ...').")

        # 6. Check CVE identifier presence
        if cve_elem is None or not (cve_elem.text and cve_elem.text.strip()):
            errors.append(f"{entry_desc}: Missing <cve> or <vulnerabilityName> element.")

    if errors:
        print(f"\n[SECURITY GATE FAILED] {len(errors)} suppression governance violation(s) detected:")
        for err in errors:
            print(f"  [ERROR] {err}")
        return 1

    print(f"[OK] All {len(suppress_elements)} suppression entry/entries meet governance policy (active < {MAX_SUPPRESSION_DAYS}d, dual sign-off, issue linked).")
    return 0

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else ".github/owasp-suppressions.xml"
    sys.exit(validate_suppressions(target))
