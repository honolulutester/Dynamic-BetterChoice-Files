import os
import re

files_to_check = [
    "app.js",
    "store.js",
    "data.js",
    "helpers.js",
    "i18n.js",
    "location-fields.js",
    "orders-sheet.js",
    "sheets-sync.js",
    "supabase.js",
    "views/auth.js",
    "views/checkout.js",
    "views/dashboard.js",
    "views/impact.js",
    "views/meals.js",
    "views/misc.js",
    "views/shop.js",
    "views/workout.js"
]

def parse_exports(filepath):
    exports = set()
    if not os.path.exists(filepath):
        return exports
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Matches: export const X, export let X, export function X, export async function X, export { X, Y }
    const_let_fn = re.findall(r"\bexport\s+(?:const|let|var|function|async\s+function)\s+([a-zA-Z0-9_]+)", content)
    for x in const_let_fn:
        exports.add(x)
        
    # Matches export { X, Y }
    curly_exports = re.findall(r"\bexport\s+\{([^}]+)\}", content)
    for group in curly_exports:
        for item in group.split(","):
            parts = item.strip().split(" as ")
            name = parts[-1].strip() # if X as Y, export Y
            if name:
                exports.add(name)
    
    # Check for export { ... } from '...'
    re_exports = re.findall(r"\bexport\s+\{([^}]+)\}\s+from", content)
    for group in re_exports:
        for item in group.split(","):
            parts = item.strip().split(" as ")
            name = parts[-1].strip()
            if name:
                exports.add(name)
                
    return exports

def analyze_imports():
    errors = []
    print("Starting codebase import audit...")
    for filepath in files_to_check:
        if not os.path.exists(filepath):
            print(f"Skipping missing file: {filepath}")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        # Parse imports
        content = "".join(lines)
        # Matches: import { X, Y } from 'Z'
        imports = re.findall(r"import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"]", content)
        
        for named_bindings, import_path in imports:
            # Resolve relative import path
            dir_name = os.path.dirname(filepath)
            target_path = os.path.normpath(os.path.join(dir_name, import_path))
            
            # ESM.sh external import
            if import_path.startswith("http") or "esm.sh" in import_path:
                continue
                
            if not os.path.exists(target_path) and not target_path.endswith(".js"):
                # Try adding .js
                if os.path.exists(target_path + ".js"):
                    target_path += ".js"
                else:
                    errors.append(f"[{filepath}] Import target does not exist: {import_path} (resolved to {target_path})")
                    continue
            
            if not os.path.exists(target_path):
                errors.append(f"[{filepath}] Import target does not exist: {import_path} (resolved to {target_path})")
                continue
                
            # Parse target exports
            target_exports = parse_exports(target_path)
            
            # Check bindings
            bindings = [b.strip().split(" as ")[0].strip() for b in named_bindings.split(",")]
            for b in bindings:
                if not b:
                    continue
                if b not in target_exports:
                    errors.append(f"[{filepath}] Imported binding '{b}' not found in '{import_path}' (exports found: {sorted(list(target_exports))})")

    if errors:
        print("\n--- AUDIT ERRORS FOUND ---")
        for err in errors:
            print(err)
    else:
        print("\n--- AUDIT SUCCESS: All internal ESM imports are fully resolved! ---")

if __name__ == "__main__":
    analyze_imports()
