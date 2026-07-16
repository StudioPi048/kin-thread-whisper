import os
import re

directory = "src/"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    # Find all buttons that have title="something" and no aria-label
    # We will use a regex substitution with a function to check conditions
    
    def replacer(match):
        button_tag = match.group(0)
        # if it already has aria-label, skip
        if 'aria-label=' in button_tag:
            return button_tag
        
        # extract title value
        title_match_str = re.search(r'title="([^"]+)"', button_tag)
        if title_match_str:
            title_val = title_match_str.group(1)
            # add aria-label right after title
            new_tag = button_tag.replace(title_match_str.group(0), f'{title_match_str.group(0)} aria-label="{title_val}"')
            return new_tag
            
        title_match_expr = re.search(r'title=\{([^}]+)\}', button_tag)
        if title_match_expr:
            title_val = title_match_expr.group(1)
            # add aria-label right after title
            new_tag = button_tag.replace(title_match_expr.group(0), f'{title_match_expr.group(0)} aria-label={{{title_val}}}')
            return new_tag

        return button_tag

    # Match anything starting with <button and ending with >
    # Caution: this won't match multi-line button tags perfectly if there's > inside strings, but standard JSX should be okay with greedy up to first >? No, non-greedy.
    # Actually, let's just replace all occurrences of `title="([^"]+)"` inside a button? 
    # Let's match `<button ... >` across multiple lines.
    
    content = re.sub(r'<button\b[^>]*>', replacer, content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated: {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))

print("Aria-labels added.")
