import ast
import sys
import re

filepath = "server/src/clients/metafinder_client/metafinder_client/client.py"

try:
    with open(filepath, 'r') as f:
        source = f.read()
except FileNotFoundError:
    print(f"Error: File {filepath} not found.")
    sys.exit(1)

# Remove generic syntax [T: MetafinderModel] which is Python 3.12+
# This is a hack to allow Python 3.9 to parse the file for docstring removal
# We will use regex to find docstrings if AST fails, or just clean up the file manually.
# Actually, let's use a simpler regex-based approach since AST parsing fails on 3.9.

docstring_regex = re.compile(r'(""".*?"""|\'\'\'.*?\'\'\')', re.DOTALL)

def remove_docstrings(text):
    # This is risky but let's try to identify docstrings by position
    lines = text.splitlines(keepends=True)
    new_lines = []
    
    in_docstring = False
    quote_char = None
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Very basic module docstring or class/func docstring detection
        # This is a fallback since AST failed.
        if not in_docstring:
            if stripped.startswith('"""') or stripped.startswith("'''"):
                if stripped.endswith('"""') and len(stripped) >= 6:
                    continue # single line docstring
                if stripped.endswith("'''") and len(stripped) >= 6:
                    continue # single line docstring
                
                in_docstring = True
                quote_char = '"""' if stripped.startswith('"""') else "'''"
                continue
            new_lines.append(line)
        else:
            if quote_char in stripped:
                in_docstring = False
                continue
    
    return "".join(new_lines)

# Since we want to be safe and AST is better, let's try to just use a regex
# that only targets strings starting at the beginning of a line (module doc)
# or after indentation.

# Let's try to "fix" the source for AST parsing by removing the generic type hint temporarily
fixed_source = re.sub(r'\[T: \w+\]', '', source)
try:
    tree = ast.parse(fixed_source)
    lines = source.splitlines(keepends=True)
    ranges_to_remove = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, (ast.Constant, ast.Str)):
                val = node.body[0].value.value if isinstance(node.body[0].value, ast.Constant) else node.body[0].value.s
                if isinstance(val, str):
                    docstring_node = node.body[0]
                    # Note: end_lineno might not be available in 3.9 for all nodes, but let's try
                    start = docstring_node.lineno - 1
                    end = getattr(docstring_node, "end_lineno", start + 1)
                    ranges_to_remove.append((start, end))
    
    ranges_to_remove.sort(reverse=True)
    for start, end in ranges_to_remove:
        # Check if it's actually a docstring (usually triple quotes)
        # to avoid removing regular strings if the AST mapping is slightly off
        del lines[start:end]
    
    result = "".join(lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    with open(filepath, 'w') as f:
        f.write(result)
    print(f"Successfully processed with AST fallback. Removed {len(ranges_to_remove)} docstrings.")

except Exception as e:
    print(f"AST Fallback failed: {e}")
    # Final fallback: generic regex (less safe but effective)
    # This targets triple quoted strings that are not assigned to variables
    # We'll just do nothing if AST fails to avoid corruption.
    sys.exit(1)
