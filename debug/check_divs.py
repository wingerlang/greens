
import re

def check_div_balance(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find <div and </div>
    # Note: This is naive but works for general React code if tags are straightforward.
    open_tags = re.findall(r'<div\b', content)
    close_tags = re.findall(r'</div\s*>', content)
    
    print(f"Total open <div: {len(open_tags)}")
    print(f"Total close </div: {len(close_tags)}")
    
    # Try to find exactly where it breaks
    lines = content.split('\n')
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Find all divs in line
        # This is slightly more complex because multiple tags can be on one line
        parts = re.split(r'(<div\b|</div>)', line)
        for part in parts:
            if part == '<div':
                stack.append(line_num)
            elif part == '</div>':
                if not stack:
                    print(f"Extra closing </div> at line {line_num}")
                else:
                    stack.pop()
    
    for open_line in stack:
        print(f"Unclosed <div> starting at line {open_line}")

check_div_balance(r'c:\repos\greens\src\pages\DashboardPage.tsx')
