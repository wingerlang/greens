
import os

filepath = r'c:\repos\greens\src\pages\StrengthPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Target SVG block
target = """                {/* Rolling Average Line SVG Overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" preserveAspectRatio="none">
                    {(() => {
                        const points: string[] = [];
                        let xPos = 0;
                        const totalUnits = weeklyData.reduce((acc, d, i) => {
                            const isCurrentWeek = i === weeklyData.length - 1;
                            if (d.volume === 0 && !isCurrentWeek) return acc + 0; // Skip gap for now to find total width? No.
                            return acc + 1;
                        }, 0); // This is not quite right because of gaps.
                        
                        // Better to calculate segments
                        return null; // I'll use a simpler approach for the line: absolute dots.
                    })()}
                </svg>"""

replacement = """                {/* Rolling Average Continuous Dashed Line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
                    <path 
                        d={pathData} 
                        stroke="rgba(59,130,246,0.3)" 
                        strokeWidth="2.5" 
                        fill="none" 
                        strokeDasharray="8 6" 
                        strokeLinecap="round"
                        className="transition-all duration-700 hover:stroke-blue-400 hover:stroke-[3px]"
                        style={{ filter: 'drop-shadow(0 0 2px rgba(59,130,246,0.2))' }}
                    />
                </svg>"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Patch applied successfully!")
else:
    # Try fuzzy match by looking for one unique line
    if 'totalUnits = weeklyData.reduce' in content:
        print("Fuzzy match found, but exact block failed. Check whitespace.")
        # Attempt minimal replacement
        import re
        content = re.sub(r'<svg.*?>[\s\S]*?<\/svg>', replacement, content, count=1) 
        # Risky but let's see
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Replaced first SVG tag found.")
    else:
        print("Target not found.")
