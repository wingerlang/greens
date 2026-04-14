import sys
import re

file_path = 'src/components/activities/detail/PrepTabContent.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix avgHR
text = text.replace('analysis.avgRunHR', 'analysis.avgHR')

# Space & padding replacements
text = text.replace('space-y-6', 'space-y-3')
text = text.replace('space-y-4', 'space-y-2')
text = text.replace('p-5 ', 'p-3 ')
text = text.replace('p-5"', 'p-3"')
text = text.replace('p-4 ', 'p-2.5 ')
text = text.replace('p-4"', 'p-2.5"')
text = text.replace('p-3 ', 'p-2 ')
text = text.replace('p-3"', 'p-2"')
text = text.replace('mb-5', 'mb-3')
text = text.replace('mb-4', 'mb-2')
text = text.replace('mb-6', 'mb-3')
text = text.replace('mt-4', 'mt-2')
text = text.replace('mt-6', 'mt-3')
text = text.replace('pt-4', 'pt-2')
text = text.replace('gap-6', 'gap-3')
text = text.replace('gap-4', 'gap-2')

# Carefully replace border radius
text = text.replace('rounded-xl', 'rounded_TEMP')
text = text.replace('rounded-2xl', 'rounded-xl')
text = text.replace('rounded_TEMP', 'rounded-lg')

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated PrepTabContent.tsx styling and fixed avgHR.")
