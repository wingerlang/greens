import re

with open("src/components/Omnibox.tsx", "r") as f:
    content = f.read()

# Replace the conflict block
content = re.sub(
    r'<<<<<<< HEAD\n=======\n        if \(frequentCombos.length > 0\) items\.push\(\.\.\.frequentCombos\);\n        if \(savedEstimates.length > 0\) items\.push\(\.\.\.savedEstimates\);\n        if \(standardQuickMeals.length > 0\) items\.push\(\.\.\.standardQuickMeals\);\n>>>>>>> origin/main\n',
    '',
    content
)

# Add frequentCombos to mixedFoodItems
content = content.replace(
    'const mixedFoodItems: any[] = [\n            ...savedEstimates,',
    'const mixedFoodItems: any[] = [\n            ...frequentCombos,\n            ...savedEstimates,'
)

with open("src/components/Omnibox.tsx", "w") as f:
    f.write(content)
