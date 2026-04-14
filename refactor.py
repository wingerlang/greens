import sys

file_path = 'src/components/activities/ActivityDetailModal.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

imports = """import { ExpandableExercise } from './detail/ExpandableExercise.tsx';
import { SplitsSparkline } from './detail/SplitsSparkline.tsx';
import { IntervalMiniSummary } from './detail/IntervalMiniSummary.tsx';
import { BestEffortPerformanceCard } from './detail/BestEffortPerformanceCard.tsx';
import { RaceHistoryCard } from './detail/RaceHistoryCard.tsx';
import { PrepTabContent } from './detail/PrepTabContent.tsx';
import { SessionGroup } from './detail/SessionGroup.tsx';
"""

# Find the start line for // Expandable Exercise Component
start_idx = -1
for i, line in enumerate(lines):
    if line.startswith('// Expandable Exercise Component - click to show sets'):
        start_idx = i
        break

# Find the end line export interface ActivityDetailModalProps
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith('export interface ActivityDetailModalProps'):
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + [imports + '\n'] + lines[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Successfully replaced from line {start_idx+1} to {end_idx}")
else:
    print(f"Failed to find indices: start={start_idx}, end={end_idx}")
