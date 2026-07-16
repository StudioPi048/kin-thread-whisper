import os
import re

def replace_mahogany(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.tsx', '.ts', '.jsx', '.js', '.html')):
                continue
            
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace mahogany with forest
            new_content = re.sub(r'mahogany', 'forest', content, flags=re.IGNORECASE)
            # Ensure "Forest" capitalized where "Mahogany" was
            new_content = new_content.replace('Forest', 'Forest') # re.sub already preserves some casing but let's be careful.
            
            # Since mahogany -> forest, Mahogany -> Forest
            # Let's do it precisely
            # wait, re.sub with IGNORECASE replaces everything with 'forest'. 
            
            if content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")

def precise_replace(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.tsx', '.ts', '.jsx', '.js', '.html')):
                continue
            
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content.replace('mahogany', 'forest')
            new_content = new_content.replace('Mahogany', 'Forest')
            new_content = new_content.replace('MAHOGANY', 'FOREST')
            
            if content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")

if __name__ == "__main__":
    precise_replace("src")
