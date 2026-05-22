import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const HISTORY_PATH = "coverage/coverage_history.json";
const HTML_PATH = "coverage/coverage_history.html";

// 1. Run Deno coverage and capture the output
const coverageCmd = new Deno.Command("deno", {
    args: ["coverage", "--exclude=src/data|test", "coverage/cov_profile"],
    stdout: "piped",
    stderr: "inherit",
});

const { code, stdout } = await coverageCmd.output();
if (code !== 0) {
    console.error("Deno coverage failed.");
    Deno.exit(code);
}

const outputText = new TextDecoder().decode(stdout);
// Print the coverage output to the console for the developer
console.log(outputText);

// 2. Parse the coverage output
// Example line: | All files                                              |     77.3 |       55.7 |   56.7 |
const cleanOutputText = outputText.replace(/\u001b\[[0-9;]*m/g, '');
const match = cleanOutputText.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/);

if (!match) {
    console.warn("Could not parse coverage summary from Deno output.");
    Deno.exit(1);
}

const branchCov = parseFloat(match[1]);
const funcCov = parseFloat(match[2]);
const lineCov = parseFloat(match[3]);

console.log(`\nParsed coverage results:\n- Branch Coverage: ${branchCov}%\n- Function Coverage: ${funcCov}%\n- Line Coverage: ${lineCov}%\n`);

// 3. Update history database
await ensureDir("coverage");
let history: any[] = [];
try {
    const text = await Deno.readTextFile(HISTORY_PATH);
    history = JSON.parse(text);
} catch {
    // If file doesn't exist, create a clean starting array
}

const newEntry = {
    date: new Date().toISOString(),
    branch: branchCov,
    function: funcCov,
    line: lineCov
};

history.push(newEntry);
// Limit to last 30 runs to keep the chart legible and beautiful
if (history.length > 30) history.shift();

await Deno.writeTextFile(HISTORY_PATH, JSON.stringify(history, null, 2));
console.log(`Saved coverage history to ${HISTORY_PATH}`);

// 4. Generate beautiful HTML with a chart over time
const historyJson = JSON.stringify(history);

const htmlContent = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Greens - Kodtäckningshistorik</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-color: #0b0f19;
            --panel-bg: rgba(17, 24, 39, 0.7);
            --border-color: rgba(31, 41, 55, 0.8);
            --text-color: #e5e7eb;
            --text-muted: #9ca3af;
            --accent-cyan: #06b6d4;
            --accent-emerald: #10b981;
            --accent-purple: #8b5cf6;
            --glass-glow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            min-height: 100vh;
            background-image: radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.05) 0%, transparent 40%),
                              radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.05) 0%, transparent 40%);
            box-sizing: border-box;
        }

        .container {
            width: 92%;
            max-width: 1000px;
            margin: 40px auto;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }

        .logo-area {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo {
            font-weight: 700;
            font-size: 28px;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, var(--accent-emerald) 0%, var(--accent-cyan) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            font-size: 14px;
            color: var(--text-muted);
            margin: 2px 0 0 0;
        }

        .nav-btn {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            padding: 10px 20px;
            border-radius: 20px;
            color: var(--text-color);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
        }

        .nav-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--accent-cyan);
            box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
            transform: translateY(-1px);
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--glass-glow);
            backdrop-filter: blur(12px);
            position: relative;
            overflow: hidden;
            transition: transform 0.2s ease;
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
        }

        .stat-card.line::before { background-color: var(--accent-emerald); }
        .stat-card.branch::before { background-color: var(--accent-cyan); }
        .stat-card.function::before { background-color: var(--accent-purple); }

        .stat-label {
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 36px;
            font-weight: 700;
            color: #ffffff;
            margin: 0;
            display: flex;
            align-items: baseline;
            gap: 4px;
        }

        .stat-unit {
            font-size: 18px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .chart-panel {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 30px;
            box-shadow: var(--glass-glow);
            backdrop-filter: blur(12px);
            margin-bottom: 30px;
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin: 0;
        }

        .table-panel {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 30px;
            box-shadow: var(--glass-glow);
            backdrop-filter: blur(12px);
        }

        .table-title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin: 0 0 20px 0;
        }

        .table-container {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        td {
            padding: 14px 16px;
            border-bottom: 1px solid rgba(31, 41, 55, 0.4);
            font-size: 14px;
        }

        tr:hover td {
            background: rgba(255, 255, 255, 0.01);
        }

        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge.line { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); }
        .badge.branch { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
        .badge.function { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }

        .time-badge {
            color: var(--text-muted);
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-area">
                <div>
                    <div class="logo">Greens</div>
                    <div class="subtitle">Testtäckningshistorik & Stabilitetsanalys</div>
                </div>
            </div>
            <a href="cov_profile/html/index.html" class="nav-btn">Visa detaljerad rapport &rarr;</a>
        </header>

        <!-- Stats Cards of Latest Run -->
        <div class="stats-grid">
            <div class="stat-card line">
                <div class="stat-label">Line Coverage</div>
                <div class="stat-value">${lineCov}<span class="stat-unit">%</span></div>
            </div>
            <div class="stat-card branch">
                <div class="stat-label">Branch Coverage</div>
                <div class="stat-value">${branchCov}<span class="stat-unit">%</span></div>
            </div>
            <div class="stat-card function">
                <div class="stat-label">Function Coverage</div>
                <div class="stat-value">${funcCov}<span class="stat-unit">%</span></div>
            </div>
        </div>

        <!-- History Chart -->
        <div class="chart-panel">
            <div class="chart-header">
                <h2 class="chart-title">Utvecklingstrend över tid</h2>
            </div>
            <div style="height: 350px; position: relative;">
                <canvas id="historyChart"></canvas>
            </div>
        </div>

        <!-- History Table -->
        <div class="table-panel">
            <h2 class="table-title">Alla körningar</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum & Tid</th>
                            <th>Line %</th>
                            <th>Branch %</th>
                            <th>Function %</th>
                        </tr>
                    </thead>
                    <tbody id="historyTableBody">
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const rawHistory = ${historyJson};
        
        // Prepare data for Chart
        const labels = rawHistory.map(entry => {
            const date = new Date(entry.date);
            return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }) + ' ' + 
                   date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        });

        const lineData = rawHistory.map(entry => entry.line);
        const branchData = rawHistory.map(entry => entry.branch);
        const funcData = rawHistory.map(entry => entry.function);

        const ctx = document.getElementById('historyChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Line Coverage',
                        data: lineData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        tension: 0.3,
                        borderWidth: 3,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        fill: true
                    },
                    {
                        label: 'Branch Coverage',
                        data: branchData,
                        borderColor: '#06b6d4',
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        borderWidth: 2.5,
                        pointBackgroundColor: '#06b6d4',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4
                    },
                    {
                        label: 'Function Coverage',
                        data: funcData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        borderWidth: 2.5,
                        pointBackgroundColor: '#8b5cf6',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#9ca3af',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 12,
                                weight: 500
                            },
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1f2937',
                        titleColor: '#ffffff',
                        bodyColor: '#e5e7eb',
                        borderColor: '#374151',
                        borderWidth: 1,
                        bodyFont: {
                            family: "'Outfit', sans-serif"
                        },
                        titleFont: {
                            family: "'Outfit', sans-serif",
                            weight: 600
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(31, 41, 55, 0.2)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: 'rgba(31, 41, 55, 0.2)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 11
                            },
                            stepSize: 10
                        }
                    }
                }
            }
        });

        // Populating history table
        const tableBody = document.getElementById('historyTableBody');
        rawHistory.slice().reverse().forEach(entry => {
            const date = new Date(entry.date);
            const dateString = date.toLocaleDateString('sv-SE') + ' ' + 
                               date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
            
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td class="time-badge">\${dateString}</td>
                <td><span class="badge line">\${entry.line.toFixed(1)}%</span></td>
                <td><span class="badge branch">\${entry.branch.toFixed(1)}%</span></td>
                <td><span class="badge function">\${entry.function.toFixed(1)}%</span></td>
            \`;
            tableBody.appendChild(tr);
        });
    </script>
</body>
</html>`;

await Deno.writeTextFile(HTML_PATH, htmlContent);
console.log(`Generated beautifully visual history report at ${HTML_PATH}`);

// 5. Run show_coverage.ts helper to open this history page!
console.log("Launching coverage history in standard browser...");
const openCmd: string[] = Deno.build.os === "windows"
    ? ["cmd", "/c", "start", HTML_PATH]
    : Deno.build.os === "darwin"
    ? ["open", HTML_PATH]
    : ["xdg-open", HTML_PATH];

const openProcess = new Deno.Command(openCmd[0], {
    args: openCmd.slice(1),
    stdout: "null",
    stderr: "null",
});

try {
    await openProcess.output();
    console.log("Coverage dashboard successfully visualized!");
} catch (err) {
    console.error("Failed to automatically open dashboard:", err);
}
