document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => {
        const charts = { rps: null, latency: null, memory: null, availability: null, lbDistribution: null, activeSessions: null, hourlyTraffic: null, latencyHistory: null, statusHistory: null, services: {} };

        return {
            tab: 'overview',
            services: [],
            system: { load: [], memory: {} },
            traffic: { total: 0 },
            analytics: { endpoints: [], historyEndpoints: [], ips: [] },
            granular: { services: [], types: [], countries: [] },
            sessions: [],
            bannedIps: [],
            config: {},
            loadBalancer: { rps: 0, activeNodes: [], threshold: 10, cooldown: false, nodeStats: {}, totalMbs: 0, utilization: 0, totalCapacity: 0, timeToNextScale: null },
            simulator: { active: 0, running: 0, totalReq: 0, totalErr: 0 },
            simConfig: { targetUsers: 0, rampRate: 5, personas: { browser: 0, athlete: 0, social: 0, heavy: 0 } },
            currentService: null,
            logs: 'Loading...',
            banInput: '',
            logEntries: [],
            availabilityHistory: [],
            // availabilityChartInstance removed (in closure)

            get sortedServices() {
                const priority = ['guardian', 'frontend', 'backend'];
                return [...this.services].sort((a, b) => {
                    const idxA = priority.indexOf(a.name);
                    const idxB = priority.indexOf(b.name);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.name.localeCompare(b.name);
                });
            },

            get pageTitle() {
                if (this.tab === 'overview') return 'Ecosystem Overview';
                if (this.tab === 'simulator') return 'Traffic Simulator';
                if (this.tab === 'traffic') return 'Traffic Analytics';
                if (this.tab === 'sessions') return 'Active Sessions';
                if (this.tab === 'console') return 'Live Console';
                if (this.tab === 'debug') return 'Debug Flow Tracer';
                if (this.tab === 'load-balancer') return 'Load Balancer Dashboard';
                if (this.tab === 'security') return 'Firewall & Security';
                if (this.tab === 'waf') return 'WAF Shield Ops';
                if (this.tab === 'tools') return 'Shadow Ops / Recorder';
                if (this.tab.startsWith('service-')) {
                    return this.capitalize(this.tab.replace('service-', '')) + ' - Dedicated Service Control';
                }
                return 'Guardian 3.0';
            },

            // Debug Flow
            debugLog: [],

            // Console
            liveLogs: [],
            eventSource: null,
            autoScroll: true,

            // Tools
            isRecording: false,
            traces: [],

            // CI/CD
            ciReport: {},

            // WAF
            wafEvents: [],

            // WebSocket for real-time updates
            statsSocket: null,
            wsConnected: false,

            // New overview stats
            guardianUptime: 0,
            guardianTotalUptime: 0,
            guardianStartTime: null,
            guardianFirstSeen: 0, // Fix: Expose to Alpine scope
            totalRequests: 0,
            avgLatency: 0,
            rpsHistory: new Array(60).fill(0), // Initialize with zeros for immediate chart rendering
            currentRps: 0,
            now: Date.now(),
            rpsHistory: new Array(60).fill(0), // Initialize with zeros for immediate chart rendering
            currentRps: 0,
            now: Date.now(),
            // Chart instances removed (in closure)
            latencyData: {},
            memoryHistory: [],
            activeSessionsData: {},
            hourlyTraffic: [],
            latencyHistory: [],
            statusHistory: {},
            topEndpointsHistory: [],
            activeUsers30s: 0,
            actionMessage: '',

            // Load Balancer Tab
            simulatorRpsTarget: 25,
            lbThresholdTarget: 10,
            simulatorRpsTarget: 25,
            lbThresholdTarget: 10,
            // lbDistributionChart removed (in closure)

            async init() {
                // Deep connection: Read hash to set initial tab
                const hash = window.location.hash.slice(1);
                if (hash) {
                    this.tab = hash;
                    if (hash.startsWith('service-')) {
                        const serviceName = hash.replace('service-', '');
                    }
                }

                // FAST INITIAL LOAD: Only load critical data first
                try {
                    const [statusRes, lbRes] = await Promise.all([
                        fetch('/api/status').then(r => r.json()),
                        fetch('/api/load-balancer').then(r => r.json())
                    ]);
                    this.services = statusRes.services;
                    this.system = statusRes.system || { load: [], memory: {} };
                    this.loadBalancer = lbRes;
                    this.guardianUptime = statusRes.uptime || 0;
                    this.guardianFirstSeen = statusRes.firstSeen || Date.now();
                    if (!this.guardianStartTime) {
                        this.guardianStartTime = statusRes.startTime || (Date.now() - (this.guardianUptime * 1000));
                    }
                    this.totalRequests = statusRes.totalRequests || 0;
                    this.currentRps = (lbRes.rps || 0).toFixed(1);
                } catch (e) { /* ignore */ }

                // Start timers immediately for live updates
                this.startTimers();

                // BACKGROUND LOAD: Load remaining data without blocking
                this.loadRemainingData();

                // Load Historical Data immediately
                this.refreshUptimeHistory();
                this.loadOverviewData();

                // If we have a hash service, try to select it now that we have data
                if (hash && hash.startsWith('service-')) {
                    const serviceName = hash.replace('service-', '');
                    const service = this.services.find(s => s.name === serviceName);
                    if (service) {
                        this.selectService(service);
                    }
                }

                // Setup watchers for tab changes
                this.setupWatchers();
            },

            async loadRemainingData() {
                try {
                    const [analyticsRes, granularRes, sessionRes, bannedRes, configRes, simRes] = await Promise.all([
                        fetch('/api/analytics').then(r => r.json()),
                        fetch('/api/analytics/granular').then(r => r.json()),
                        fetch('/api/sessions').then(r => r.json()),
                        fetch('/api/banned').then(r => r.json()),
                        fetch('/api/config').then(r => r.json()),
                        fetch('/api/simulator').then(r => r.json())
                    ]);

                    this.traffic = analyticsRes.traffic;
                    this.analytics = {
                        endpoints: analyticsRes.endpoints,
                        historyEndpoints: analyticsRes.historyEndpoints || [],
                        ips: analyticsRes.ips
                    };
                    this.granular = granularRes;
                    this.sessions = sessionRes;
                    this.bannedIps = bannedRes;
                    this.config = configRes;
                    this.simulator = simRes;
                    if (simRes.config) this.simConfig = simRes.config;

                    if (this.config.recording !== undefined) {
                        this.isRecording = this.config.recording;
                    }

                    if (this.tab === 'traffic') {
                        this.updateCharts();
                        this.connectStream(); // Ensure stream is connected for traffic tab
                    }

                } catch (e) { /* ignore */ }
            },

            setupWatchers() {
                // Watch tab changes to enable/disable stream AND update URL
                this.$watch('tab', (val) => {
                    window.location.hash = val;

                    if (val === 'console') this.connectStream();
                    else this.disconnectStream();
                    if (val === 'tools') this.refreshTraces();
                    if (val === 'waf') this.refreshWaf();
                    if (val === 'debug') this.refreshDebugLog();
                    if (val === 'ci') this.fetchCiStatus();
                    if (val === 'traffic') {
                        this.refreshGranularData();
                        this.updateCharts();
                    }
                });
            },

            async refreshGranularData() {
                try {
                    this.granular = await fetch('/api/analytics/granular').then(r => r.json());
                    this.updateCharts();
                } catch (e) {
                    console.error("Failed to refresh granular stats", e);
                }
            },

            async refreshWaf() {
                this.wafEvents = await fetch('/api/waf/events').then(r => r.json());
            },

            async toggleRecording() {
                const newState = !this.isRecording;
                await fetch(`/api/recording?enabled=${newState}`, { method: 'POST' });
                this.isRecording = newState;
                await this.refreshData(); // To sync config
            },

            async refreshTraces() {
                this.traces = await fetch('/api/traces').then(r => r.json());
            },

            async fetchCiStatus() {
                try {
                    this.ciReport = await fetch('/api/ci/status').then(r => r.json());
                } catch { }
            },

            async runCiPipeline() {
                if (!confirm("Run CI Pipeline? This may take a few seconds.")) return;
                await fetch('/api/ci/run', { method: 'POST' });
                // Poll for update
                setTimeout(() => this.fetchCiStatus(), 2000);
                setTimeout(() => this.fetchCiStatus(), 5000);
            },

            async refreshDebugLog() {
                try {
                    this.debugLog = await fetch('/api/debug').then(r => r.json());
                } catch (e) {
                    console.error('Failed to fetch debug log:', e);
                }
            },

            async clearDebugLog() {
                try {
                    await fetch('/api/debug', { method: 'DELETE' });
                    this.debugLog = [];
                } catch (e) {
                    console.error('Failed to clear debug log:', e);
                }
            },

            async replayTrace(file) {
                if (!confirm(`Replay ${file} ? `)) return;
                const res = await fetch(`/ api / replay ? file = ${file}`, { method: 'POST' });
                const json = await res.json();
                alert(json.success ? `Replay Successful! Status: ${json.result.status}` : `Failed: ${json.error}`);
            },

            connectStream() {
                if (this.eventSource) return;
                this.eventSource = new EventSource('/api/live-logs');
                this.eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    data.id = Math.random().toString(36).substr(2, 9); // Client-side ID
                    this.liveLogs.push(data);
                    if (this.liveLogs.length > 200) this.liveLogs.shift();

                    if (this.autoScroll) {
                        this.$nextTick(() => {
                            const el = this.$refs.consoleContainer;
                            if (el) el.scrollTop = el.scrollHeight;
                        });
                    }
                };
            },

            disconnectStream() {
                if (this.eventSource) {
                    this.eventSource.close();
                    this.eventSource = null;
                }
            },

            async refreshData() {
                // Parallel fetching
                const [statusRes, analyticsRes, granularRes, sessionRes, bannedRes, configRes, lbRes, simRes] = await Promise.all([
                    fetch('/api/status').then(r => r.json()),
                    fetch('/api/analytics').then(r => r.json()),
                    fetch('/api/analytics/granular').then(r => r.json()),
                    fetch('/api/sessions').then(r => r.json()),
                    fetch('/api/banned').then(r => r.json()),
                    fetch('/api/config').then(r => r.json()),
                    fetch('/api/load-balancer').then(r => r.json()),
                    fetch('/api/simulator').then(r => r.json())
                ]);

                this.services = statusRes.services;
                this.system = statusRes.system || { load: [], memory: {} };
                this.loadBalancer = lbRes;
                this.traffic = analyticsRes.traffic;
                this.analytics = {
                    endpoints: analyticsRes.endpoints,
                    historyEndpoints: analyticsRes.historyEndpoints || [],
                    ips: analyticsRes.ips
                };
                this.granular = granularRes;
                this.sessions = sessionRes;
                this.bannedIps = bannedRes;
                this.config = configRes;
                this.simulator = simRes;
                if (simRes.config) this.simConfig = simRes.config;

                // Sync local recording state from config
                if (this.config.recording !== undefined) {
                    this.isRecording = this.config.recording;
                }

                // Update current service ref if selected
                if (this.currentService) {
                    this.currentService = this.services.find(s => s.name === this.currentService.name) || this.currentService;
                }

                if (this.tab === 'traffic') {
                    this.updateCharts();
                }

                if (this.tab === 'overview') {
                    this.loadOverviewData();
                    this.refreshUptimeHistory();
                }

                if (this.tab === 'load-balancer') {
                    this.$nextTick(() => this.renderLbDistributionChart());
                }
            },

            async updateSimConfig() {
                await fetch('/api/simulator', {
                    method: 'POST',
                    body: JSON.stringify(this.simConfig)
                });
            },

            startTimers() {
                // Try WebSocket first for real-time updates
                this.connectWebSocket();

                // Fast 500ms polling for overview and load-balancer tabs
                setInterval(async () => {
                    if (this.tab === 'overview' || this.tab === 'load-balancer') {
                        try {
                            const lbRes = await fetch('/api/load-balancer').then(r => r.json());

                            // Update load balancer stats (selective copy)
                            this.loadBalancer.rps = lbRes.rps || 0;
                            this.loadBalancer.totalMbs = lbRes.totalMbs || 0;
                            this.loadBalancer.activeNodes = lbRes.activeNodes || [];
                            this.loadBalancer.threshold = lbRes.threshold || 10;
                            this.loadBalancer.cooldown = lbRes.cooldown || false;
                            this.loadBalancer.nodeStats = lbRes.nodeStats || {};
                            this.loadBalancer.utilization = lbRes.utilization || 0;
                            this.loadBalancer.totalCapacity = lbRes.totalCapacity || 0;
                            this.loadBalancer.timeToNextScale = lbRes.timeToNextScale;
                            this.loadBalancer.activeCount = lbRes.activeCount || 1;
                            this.loadBalancer.simulator = lbRes.simulator;
                            this.loadBalancer.nodes = lbRes.nodes || [];
                            this.loadBalancer.totalRequests = lbRes.totalRequests || 0;

                            // Only update global stats if they are present in the response
                            if (lbRes.avgLatency !== undefined) {
                                this.avgLatency = lbRes.avgLatency;
                            }

                            // Update RPS history for chart
                            // REMOVED: this.rpsHistory.push(lbRes.rps || 0); - This was incorrect (using LB RPS for global chart) and causing double updates
                            // if (this.rpsHistory.length > 60) this.rpsHistory.shift();

                            if (this.tab === 'overview') {
                                // Chart rendering is now handled by the status loop or WS
                                this.$nextTick(() => this.renderRpsChart());
                            }
                            if (this.tab === 'load-balancer') {
                                this.$nextTick(() => this.renderLbDistributionChart());
                            }
                        } catch (e) { /* ignore */ }
                    }
                    this.now = Date.now();
                }, 1000); // Sync with 1s updates to prevent flickering

                // Poll status for service list and system stats every second
                setInterval(async () => {
                    if (this.tab === 'overview' || this.tab.startsWith('service-')) {
                        try {
                            const statusRes = await fetch('/api/status').then(r => r.json());
                            this.services = statusRes.services;

                            if (statusRes.uptime !== undefined) {
                                this.guardianUptime = statusRes.uptime;
                                this.guardianTotalUptime = statusRes.totalUptime || statusRes.uptime;
                                // Only update start time if it differs significantly (>5s) to prevent jitter
                                const newStart = statusRes.startTime || (this.now - (statusRes.uptime * 1000));
                                if (!this.guardianStartTime || Math.abs(newStart - this.guardianStartTime) > 5000) {
                                    this.guardianStartTime = newStart;
                                }
                            }
                            if (statusRes.totalRequests !== undefined) {
                                this.totalRequests = statusRes.totalRequests;
                            }

                            // Update RPS from status poll if WS is not connected
                            if (!this.wsConnected) {
                                this.currentRps = (statusRes.rps || 0).toFixed(1);
                                this.rpsHistory.push(statusRes.rps || 0);
                                if (this.rpsHistory.length > 60) this.rpsHistory.shift();

                                if (this.tab === 'overview') {
                                    this.$nextTick(() => this.renderRpsChart());
                                }
                            }
                        } catch (e) { /* ignore */ }
                    } else if (!this.wsConnected) {
                        this.refreshData();
                    }
                }, 1000);

                // Poll simulator status every second when on simulator tab
                setInterval(async () => {
                    if (this.tab === 'simulator') {
                        try {
                            const simRes = await fetch('/api/simulator').then(r => r.json());
                            this.simulator = simRes;
                            if (simRes.config) this.simConfig = simRes.config;
                        } catch (e) { /* ignore */ }
                    }
                }, 1000);

                // Poll sessions every 5 seconds when on sessions tab
                setInterval(async () => {
                    if (this.tab === 'sessions') {
                        try {
                            this.sessions = await fetch('/api/sessions').then(r => r.json());
                        } catch (e) { /* ignore */ }
                    }
                }, 5000);

                // Poll logs if service view active
                setInterval(() => {
                    if (this.tab.startsWith('service-') && this.currentService) {
                        this.fetchLogs(this.currentService.name);
                    }
                }, 2000);

                // Poll historical data periodically (every 30s)
                setInterval(() => {
                    if (this.tab === 'overview') {
                        this.refreshUptimeHistory();
                        this.loadOverviewData();
                    }
                }, 30000);
            },

            connectWebSocket() {
                if (this.statsSocket && this.statsSocket.readyState === WebSocket.OPEN) return;

                const wsUrl = `ws://${window.location.host}/ws`;
                this.statsSocket = new WebSocket(wsUrl);

                this.statsSocket.onopen = () => {
                    console.log('[Guardian] WebSocket connected');
                    this.wsConnected = true;
                };

                this.statsSocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'stats') {
                            // Update services with real-time data
                            this.services = data.services.map(newSvc => {
                                const existing = this.services.find(s => s.name === newSvc.name);
                                if (!existing) return newSvc;
                                return { ...existing, ...newSvc };
                            });

                            if (data.activeSessions) {
                                this.activeSessionsData = data.activeSessions;
                                this.activeUsers30s = data.activeSessions['30s'] || 0;
                                this.$nextTick(() => this.renderActiveSessionsChart());
                            }

                            // Update current service ref if selected
                            if (this.currentService) {
                                this.currentService = this.services.find(s => s.name === this.currentService.name) || this.currentService;
                            }

                            // Update overview stats
                            this.guardianUptime = data.uptime || 0;
                            this.guardianTotalUptime = data.totalUptime || data.uptime;
                            // Only update start time if it differs significantly (>5s) to prevent jitter
                            const newStart = data.startTime || (this.now - (data.uptime * 1000));
                            if (!this.guardianStartTime || Math.abs(newStart - this.guardianStartTime) > 5000) {
                                this.guardianStartTime = newStart;
                            }
                            this.now = Date.now(); // Update reference time on sync
                            this.currentRps = parseFloat(data.rps || 0).toFixed(1);
                            this.totalRequests = data.totalRequests || 0;
                            this.avgLatency = data.avgLatency || 0;

                            // Update RPS history for chart (keep last 60 data points)
                            this.rpsHistory.push(parseFloat(data.rps || 0));
                            if (this.rpsHistory.length > 60) {
                                this.rpsHistory.shift();
                            }

                            // Update load balancer stats from WebSocket (selective copy to avoid circular refs)
                            if (data.loadBalancer) {
                                const lb = data.loadBalancer;
                                this.loadBalancer.rps = lb.rps || 0;
                                this.loadBalancer.totalMbs = lb.totalMbs || 0;
                                this.loadBalancer.activeNodes = lb.activeNodes || [];
                                this.loadBalancer.threshold = lb.threshold || 10;
                                this.loadBalancer.cooldown = lb.cooldown || false;
                                this.loadBalancer.nodeStats = lb.nodeStats || {};
                                this.loadBalancer.utilization = lb.utilization || 0;
                                this.loadBalancer.totalCapacity = lb.totalCapacity || 0;
                                this.loadBalancer.timeToNextScale = lb.timeToNextScale;
                                this.loadBalancer.activeCount = lb.activeCount || 1;
                                this.loadBalancer.nodes = lb.nodes || [];
                                this.loadBalancer.totalRequests = lb.totalRequests || 0;
                            }

                            // Render RPS chart if on overview tab
                            if (this.tab === 'overview') {
                                this.$nextTick(() => this.renderRpsChart());
                            }
                        }
                    } catch (e) {
                        console.error('WebSocket message parse error:', e);
                    }
                };

                this.statsSocket.onclose = () => {
                    console.log('[Guardian] WebSocket closed, will reconnect...');
                    this.wsConnected = false;
                    // Reconnect after 3 seconds
                    setTimeout(() => this.connectWebSocket(), 3000);
                };

                this.statsSocket.onerror = () => {
                    this.wsConnected = false;
                };
            },

            selectService(service) {
                this.currentService = service;
                this.tab = 'service-' + service.name;
                this.logs = "Loading logs...";
                this.fetchLogs(service.name);
                this.fetchServiceHistory(service.name);
            },

            async fetchServiceHistory(name) {
                const [metrics, daily] = await Promise.all([
                    fetch(`/api/metrics?service=${name}&limit=100`).then(r => r.json()),
                    fetch(`/api/analytics/service-history?service=${name}`).then(r => r.json())
                ]);

                this.renderServiceCharts(metrics, daily);
            },

            renderServiceCharts(metrics, daily) {
                this.$nextTick(() => {
                    // Load Chart (Line)
                    this.renderChart('serviceLoadChart', 'line', {
                        labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
                        datasets: [
                            { label: 'CPU %', data: metrics.map(m => m.cpu), borderColor: '#3b82f6', tension: 0.4 },
                            { label: 'Memory (MB)', data: metrics.map(m => (m.memory / 1024 / 1024).toFixed(1)), borderColor: '#a855f7', tension: 0.4 }
                        ]
                    });

                    // Requests Chart (Bar)
                    this.renderChart('serviceRequestsChart', 'bar', {
                        labels: daily.map(d => d.date),
                        datasets: [{ label: 'Requests', data: daily.map(d => d.count), backgroundColor: '#22c55e' }]
                    });
                });
            },

            renderChart(id, type, data) {
                if (charts.services[id]) {
                    charts.services[id].destroy();
                }
                const ctx = document.getElementById(id);
                if (!ctx) return;

                charts.services[id] = new Chart(ctx, {
                    type: type,
                    data: {
                        labels: data.labels,
                        datasets: data.datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#334155' } },
                            x: { grid: { display: false } }
                        },
                        plugins: { legend: { labels: { color: '#94a3b8' } } }
                    }
                });
            },

            async fetchLogs(name) {
                const res = await fetch(`/api/logs?service=${name}`);
                const logs = await res.json();
                this.logEntries = logs.slice(-100);
                this.$nextTick(() => {
                    if (this.autoScroll && this.$refs.logContainer) {
                        this.$refs.logContainer.scrollTop = this.$refs.logContainer.scrollHeight;
                    }
                });
            },

            async controlService(name, action) {
                if (!confirm(action.toUpperCase() + " " + name + "?")) return;
                await fetch(`/api/control?service=${name}&action=${action}`, { method: 'POST' });
                await this.refreshData();
            },

            async restartAll() {
                if (!confirm("Restart ALL services?")) return;
                await fetch(`/api/global?action=restart-all`, { method: 'POST' });
            },

            async banIp(ip) {
                if (!ip) return;
                await fetch(`/api/global?action=ban&ip=${ip}`, { method: 'POST' });
                await this.refreshData();
            },

            async unbanIp(ip) {
                await fetch(`/api/global?action=unban&ip=${ip}`, { method: 'POST' });
                await this.refreshData();
            },

            handleRequestPing(data) {
                // Animate Top Bar Ping
                const pingEl = document.getElementById('live-ping');
                if (pingEl) {
                    pingEl.style.opacity = '1';
                    pingEl.style.transform = 'scale(1.5)';
                    setTimeout(() => {
                        pingEl.style.opacity = '0.2';
                        pingEl.style.transform = 'scale(1)';
                    }, 150);
                }

                // Add to traffic pings
                this.trafficPings.unshift({
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: Date.now(),
                    method: data.method,
                    path: data.path,
                    country: data.country || 'XX',
                    status: data.status,
                    ip: data.ip
                });
                if (this.trafficPings.length > 20) this.trafficPings.pop();
            },

            updateCharts() {
                // Wait for x-show transition
                setTimeout(() => {
                    this.$nextTick(() => {
                        if (this.tab !== 'traffic') return;

                        this.renderPieChart('serviceChart', this.granular.services.map(s => s.name), this.granular.services.map(s => s.count), ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']);
                        this.renderPieChart('typeChart', this.granular.types.map(s => s.type), this.granular.types.map(s => s.count), ['#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#c084fc']);

                        if (this.granular.countries) {
                            this.renderPieChart('geoChart', this.granular.countries.map(c => c.code), this.granular.countries.map(c => c.count), ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6']);
                        }
                    });
                }, 100);
            },

            renderPieChart(id, labels, data, colors) {
                if (charts[id]) {
                    charts[id].data.labels = labels;
                    charts[id].data.datasets[0].data = data;
                    charts[id].update();
                    return;
                }
                const ctx = document.getElementById(id);
                if (!ctx) return;
                charts[id] = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { color: '#94a3b8' } }
                        }
                    }
                });
            },
            capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); },
            getUptimeColor(percentStr) {
                const p = parseFloat(percentStr);
                if (p >= 99.9) return '#22c55e';
                if (p >= 98) return '#10b981';
                if (p >= 95) return '#f59e0b';
                return '#ef4444';
            },
            getStatusColor(status) {
                if (status === 'running') return '#22c55e';
                if (status === 'stopped') return '#ef4444';
                if (status === 'starting') return '#f59e0b';
                return '#94a3b8';
            },
            formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },

            formatTime(ts) {
                return new Date(ts).toLocaleTimeString();
            },

            formatUptime(seconds) {
                if (seconds === undefined || seconds === null || seconds < 0) return '0s';
                const s_int = Math.floor(seconds);
                const days = Math.floor(s_int / 86400);
                const hours = Math.floor((s_int % 86400) / 3600);
                const mins = Math.floor((s_int % 3600) / 60);
                const s = s_int % 60;

                let res = '';
                if (days > 0) res += `${days}d `;
                if (hours > 0 || days > 0) res += `${hours}h `;
                res += `${mins}m ${s}s`;
                return res.trim() || '0s';
            },

            calculateUptimePercent(service) {
                if (!service || !service.persistedUptime) return '0.0000%';
                const { total, firstSeen } = service.persistedUptime;
                if (!firstSeen) return '100.0000%';

                // Calculate real-time total uptime
                let realTotal = total;
                if (service.status === 'running' && service.startTime) {
                    const sessionUptime = (this.now - service.startTime) / 1000;
                    const unloggedUptime = Math.max(0, sessionUptime - (service.uptime || 0));
                    realTotal += unloggedUptime;
                }

                const elapsedMs = this.now - firstSeen;
                const elapsedSec = Math.max(1, Math.floor(elapsedMs / 1000));

                const percent = (realTotal / elapsedSec) * 100;
                if (percent >= 100) return '100.0000%';
                if (percent < 0) return '0.0000%';
                return percent.toFixed(4) + '%';
            },

            renderRpsChart() {
                const ctx = document.getElementById('rpsChart');
                if (!ctx) return;

                const labels = this.rpsHistory.map((_, i) => '');

                if (charts.rps) {
                    charts.rps.data.labels = labels;
                    charts.rps.data.datasets[0].data = [...this.rpsHistory]; // Copy array
                    charts.rps.update(); // Force update
                    return;
                }

                charts.rps = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'RPS',
                            data: [...this.rpsHistory], // Fix: Break Proxy reference
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            spanGaps: true // Ensure lines connect even if data is missing
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: '#334155' },
                                ticks: { color: '#94a3b8' }
                            },
                            x: { display: false }
                        },
                        plugins: { legend: { display: false } },
                        animation: false
                    }
                });
            },

            async refreshUptimeHistory() {
                try {
                    // We track uptime for 'guardian' as the system representative on overview
                    const res = await fetch('/api/analytics/uptime-history?service=guardian&days=14').then(r => r.json());
                    this.availabilityHistory = res;
                    this.$nextTick(() => this.renderAvailabilityChart());
                } catch (e) { console.error('Failed to update uptime history:', e); }
            },

            renderAvailabilityChart() {
                const ctx = document.getElementById('availabilityChart');
                if (!ctx) return;

                // Handle empty history gracefully
                const history = this.availabilityHistory || [];
                const labels = history.map(h => h.date ? h.date.split('-').slice(1).join('/') : '');
                const data = history.map(h => h.percent || 0);

                if (charts.availability) {
                    charts.availability.data.labels = labels;
                    charts.availability.data.datasets[0].data = data;
                    charts.availability.update();
                    return;
                }

                charts.availability = new Chart(ctx, {
                    type: 'bar', // Changed to BAR as requested
                    data: {
                        labels: labels.length ? labels : ['No Data'],
                        datasets: [{
                            label: 'Availability %',
                            data: data.length ? data : [0],
                            backgroundColor: data.map(v => v >= 99 ? '#22c55e' : (v >= 95 ? '#f59e0b' : '#ef4444')),
                            borderRadius: 4,
                            maxBarThickness: 40
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                grid: { color: '#334155' },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: (v) => v + '%'
                                }
                            },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            },

            getServiceUptime(name) {
                const s = this.services.find(svc => svc.name === name);
                if (!s || s.status !== 'running' || !s.startTime) return '0s';

                // Pure client-side calculation for smooth, monotonic timer
                // Format: Hh Mm (or similar)
                return this.formatUptime((this.now - s.startTime) / 1000);
            },

            getServiceTotalUptime(name) {
                const s = this.services.find(svc => svc.name === name);
                if (!s || !s.persistedUptime) return '0s';

                let total = s.persistedUptime.total || 0;
                // Add current session if running
                if (s.status === 'running' && s.startTime) {
                    const sessionUptime = (this.now - s.startTime) / 1000;
                    const unloggedUptime = Math.max(0, sessionUptime - (s.uptime || 0));
                    total += unloggedUptime;
                }
                return this.formatUptime(total);
            },

            get currentGuardianUptime() {
                if (!this.guardianStartTime) return this.guardianUptime;
                return Math.floor((this.now - this.guardianStartTime) / 1000);
            },

            getServiceAvailability(name) {
                const s = this.services.find(svc => svc.name === name);
                if (!s || !s.persistedUptime) return '0%';
                // Use the same logic as calculateUptimePercent but return clean string
                const { total, firstSeen } = s.persistedUptime;
                if (!firstSeen) return '100%';

                let realTotal = total;
                if (s.status === 'running' && s.startTime) {
                    const sessionUptime = (this.now - s.startTime) / 1000;
                    const unloggedUptime = Math.max(0, sessionUptime - (s.uptime || 0));
                    realTotal += unloggedUptime;
                }

                const elapsedMs = this.now - firstSeen;
                const elapsedSec = Math.max(1, Math.floor(elapsedMs / 1000));

                const percent = (realTotal / elapsedSec) * 100;
                if (percent >= 100) return '100%';
                if (percent < 0) return '0%';
                return percent.toFixed(2) + '%';
            },

            getTimeDiff(ts) {
                const diff = Math.floor((this.now - ts) / 1000);
                if (diff < 60) return `${diff}s ago`;
                const m = Math.floor(diff / 60);
                const s = diff % 60;
                if (diff < 3600) return `${m}min ${s}s ago`;
                return `${Math.floor(diff / 3600)}h ago`;
            },

            getTraceRowStyle(entry) {
                const diff = (this.now - entry.timestamp) / 1000;
                let style = '';
                // Stepped aging logic (1-5 min) - Less aggressive
                if (diff > 300) style += 'opacity: 0.5; filter: grayscale(0.8);';
                else if (diff > 240) style += 'opacity: 0.6; filter: grayscale(0.6);';
                else if (diff > 180) style += 'opacity: 0.7; filter: grayscale(0.4);';
                else if (diff > 120) style += 'opacity: 0.8; filter: grayscale(0.2);';
                else if (diff > 60) style += 'opacity: 0.9;';

                if (entry.phase === 'PROXY_FAIL') style += 'background: rgba(239, 68, 68, 0.1);';
                return style;
            },

            async quickAction(action) {
                this.actionMessage = '';
                try {
                    const res = await fetch(`/api/quick-action?action=${action}`, { method: 'POST' });
                    const data = await res.json();
                    this.actionMessage = data.message || (data.success ? 'Action completed!' : 'Action failed');
                    setTimeout(() => { this.actionMessage = ''; }, 3000);
                    this.refreshData();
                } catch (e) {
                    this.actionMessage = 'Error: ' + e.message;
                    setTimeout(() => { this.actionMessage = ''; }, 3000);
                }
            },

            renderLbDistributionChart() {
                const ctx = document.getElementById('lbDistributionChart');
                if (!ctx || !this.loadBalancer.nodes) return;

                const nodes = this.loadBalancer.nodes;
                const labels = nodes.map(n => n.name.toUpperCase());
                const data = nodes.map(n => n.requests || 0);
                const colors = nodes.map(n => n.active ? 'rgba(16, 185, 129, 0.7)' : 'rgba(100, 100, 100, 0.3)');

                if (charts.lbDistribution) {
                    charts.lbDistribution.data.labels = labels;
                    charts.lbDistribution.data.datasets[0].data = data;
                    charts.lbDistribution.data.datasets[0].backgroundColor = colors;
                    charts.lbDistribution.update('none');
                    return;
                }

                charts.lbDistribution = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { color: '#94a3b8' } }
                        }
                    }
                });
            },

            getStatusColor(status) {
                if (status === 'running') return 'var(--success)';
                if (status === 'stopped') return 'var(--danger)';
                return 'var(--warning)';
            },

            // Helpers for Node Grid
            getNodeName(i) {
                return i === 1 ? 'backend' : 'backend-' + i;
            },
            getNodeClass(i) {
                const name = this.getNodeName(i);
                if (this.loadBalancer.activeNodes && this.loadBalancer.activeNodes.includes(name)) return 'active';
                const svc = this.services.find(s => s.name === name);
                if (svc && svc.status === 'starting') return 'starting';
                return 'inactive';
            },
            getNodeStatus(i) {
                const name = this.getNodeName(i);
                const svc = this.services.find(s => s.name === name);
                return svc ? svc.status : 'stopped';
            },
            getNodeRps(i) {
                const name = this.getNodeName(i);
                return this.loadBalancer.nodeStats && this.loadBalancer.nodeStats[name] ? this.loadBalancer.nodeStats[name].rps.toFixed(1) : '0.0';
            },
            getNodeMbs(i) {
                const name = this.getNodeName(i);
                return this.loadBalancer.nodeStats && this.loadBalancer.nodeStats[name] ? this.loadBalancer.nodeStats[name].mbs.toFixed(2) : '0.00';
            },
            getNodeUtil(i) {
                const name = this.getNodeName(i);
                if (!this.loadBalancer.nodeStats || !this.loadBalancer.nodeStats[name]) return 0;
                const rps = this.loadBalancer.nodeStats[name].rps;
                return Math.min(100, (rps / this.loadBalancer.threshold) * 100);
            },
            getNodeColor(i) {
                const util = this.getNodeUtil(i);
                if (util > 90) return '#ef4444';
                if (util > 70) return '#f59e0b';
                return '#10b981';
            },

            // Load Balancer Controls
            async lbStartSimulator() {
                try {
                    await fetch(`/api/load-balancer/simulator/start?rps=${this.simulatorRpsTarget}`, { method: 'POST' });
                    this.actionMessage = `Simulator started at ${this.simulatorRpsTarget} RPS`;
                } catch (e) {
                    this.actionMessage = 'Failed to start simulator';
                }
            },

            async lbStopSimulator() {
                try {
                    await fetch('/api/load-balancer/simulator/stop', { method: 'POST' });
                    this.actionMessage = 'Simulator stopped';
                } catch (e) {
                    this.actionMessage = 'Failed to stop simulator';
                }
            },

            async lbSetSimulatorRps() {
                try {
                    await fetch(`/api/load-balancer/simulator/set-rps?rps=${this.simulatorRpsTarget}`, { method: 'POST' });
                    this.actionMessage = `Simulator RPS updated to ${this.simulatorRpsTarget}`;
                } catch (e) {
                    this.actionMessage = 'Failed to update RPS';
                }
            },

            async lbResetStats() {
                try {
                    await fetch('/api/load-balancer/reset-stats', { method: 'POST' });
                    this.actionMessage = 'Load balancer stats reset';
                } catch (e) {
                    this.actionMessage = 'Failed to reset stats';
                }
            },

            async lbScaleUp(nodeName) {
                try {
                    await fetch(`/api/load-balancer/scale-up?node=${nodeName}`, { method: 'POST' });
                    this.actionMessage = `Started node: ${nodeName}`;
                } catch (e) {
                    this.actionMessage = `Failed to start node: ${nodeName}`;
                }
            },

            async lbScaleDown(nodeName) {
                try {
                    await fetch(`/api/load-balancer/scale-down?node=${nodeName}`, { method: 'POST' });
                    this.actionMessage = `Stopped node: ${nodeName}`;
                } catch (e) {
                    this.actionMessage = `Failed to stop node: ${nodeName}`;
                }
            },

            async restartAll() {
                if (!confirm("Restart all managed services (Backend/Frontend)?")) return;
                await fetch('/api/global?action=restart-all', { method: 'POST' });
                alert("Restart command sent.");
            },

            async restartGuardian() {
                if (!confirm("RESTART GUARDIAN SYSTEM? Connection will be lost momentarily.")) return;
                try {
                    await fetch('/api/global?action=restart-guardian', { method: 'POST' });
                } catch (e) { /* Expected to fail as server dies */ }

                this.actionMessage = "Rebooting System...";
                setTimeout(() => location.reload(), 3000);
            },

            async loadOverviewData() {
                try {
                    const [latencyRes, memoryRes, sessionRes] = await Promise.all([
                        fetch('/api/latency').then(r => r.json()),
                        fetch('/api/memory-history').then(r => r.json()),
                        fetch('/api/analytics/sessions-active').then(r => r.json())
                    ]);
                    this.latencyData = latencyRes;
                    this.memoryHistory = memoryRes;
                    this.activeSessionsData = sessionRes;

                    this.$nextTick(() => {
                        this.renderLatencyChart();
                        this.renderMemoryChart();
                        this.renderActiveSessionsChart();
                    });
                } catch (e) { /* */ }
            },

            renderLatencyChart() {
                const ctx = document.getElementById('latencyChart');
                if (!ctx) return;
                const labels = this.latencyData.buckets ? [...this.latencyData.buckets] : []; // Fix: Copy
                const data = this.latencyData.counts ? [...this.latencyData.counts] : []; // Fix: Copy

                if (charts.latency) {
                    charts.latency.data.labels = labels;
                    charts.latency.data.datasets[0].data = data;
                    charts.latency.update();
                    return;
                }

                charts.latency = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Requests',
                            data: data,
                            backgroundColor: '#3b82f6'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#334155' } },
                            x: { grid: { display: false } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            },

            renderMemoryChart() {
                const ctx = document.getElementById('memoryChart');
                if (!ctx) return;
                const labels = this.memoryHistory.map(m => new Date(m.timestamp).toLocaleTimeString());
                const data = this.memoryHistory.map(m => (m.rss / 1024 / 1024).toFixed(1));

                if (charts.memory) {
                    charts.memory.data.labels = labels;
                    charts.memory.data.datasets[0].data = data;
                    charts.memory.update();
                    return;
                }

                charts.memory = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'RSS Memory (MB)',
                            data: data,
                            borderColor: '#a855f7',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: false, grid: { color: '#334155' } },
                            x: { display: false }
                        },
                        plugins: { legend: { display: false } },
                        animation: false
                    }
                });
            },

            renderActiveSessionsChart() {
                const ctx = document.getElementById('activeSessionsChart');
                if (!ctx) return;

                const labels = ['30s', '1m', '5m', '10m', '60m'];
                const data = [
                    this.activeSessionsData['30s'] || 0,
                    this.activeSessionsData['1m'] || 0,
                    this.activeSessionsData['5m'] || 0,
                    this.activeSessionsData['10m'] || 0,
                    this.activeSessionsData['60m'] || 0
                ];

                if (charts.activeSessions) {
                    charts.activeSessions.data.datasets[0].data = data;
                    charts.activeSessions.update();
                    return;
                }

                charts.activeSessions = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Active Sessions',
                            data: data,
                            backgroundColor: '#ec4899',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            },

            async fetchAnalytics() {
                try {
                    const [hourly, status, latency, endpoints] = await Promise.all([
                        fetch('/api/analytics/hourly-traffic').then(r => r.json()),
                        fetch('/api/analytics/status-history').then(r => r.json()),
                        fetch('/api/analytics/latency-history').then(r => r.json()),
                        fetch('/api/top-endpoints?days=7&limit=20').then(r => r.json())
                    ]);
                    this.hourlyTraffic = hourly;
                    this.statusHistory = status;
                    this.latencyHistory = latency;
                    this.topEndpointsHistory = endpoints;

                    this.$nextTick(() => {
                        this.renderHourlyTrafficChart();
                        this.renderStatusHistoryChart();
                        this.renderLatencyHistoryChart();
                    });
                } catch (e) {
                    console.error('Failed to fetch analytics:', e);
                }
            },

            renderHourlyTrafficChart() {
                const ctx = document.getElementById('hourlyTrafficChart');
                if (!ctx) return;
                const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
                if (charts.hourlyTraffic) {
                    charts.hourlyTraffic.data.datasets[0].data = this.hourlyTraffic;
                    charts.hourlyTraffic.update();
                    return;
                }
                charts.hourlyTraffic = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Requests',
                            data: this.hourlyTraffic,
                            backgroundColor: '#3b82f6',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            },

            renderLatencyHistoryChart() {
                const ctx = document.getElementById('latencyHistoryChart');
                if (!ctx) return;
                const labels = this.latencyHistory.map(h => h.date);
                const data = this.latencyHistory.map(h => h.avg);
                if (charts.latencyHistory) {
                    charts.latencyHistory.data.labels = labels;
                    charts.latencyHistory.data.datasets[0].data = data;
                    charts.latencyHistory.update();
                    return;
                }
                charts.latencyHistory = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Avg Latency (ms)',
                            data: data,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            },

            renderStatusHistoryChart() {
                const ctx = document.getElementById('statusHistoryChart');
                if (!ctx) return;
                const labels = Object.keys(this.statusHistory);
                const data = Object.values(this.statusHistory);
                const colors = labels.map(l => l.startsWith('2') ? '#10b981' : l.startsWith('4') ? '#f59e0b' : '#ef4444');

                if (charts.statusHistory) {
                    charts.statusHistory.data.labels = labels;
                    charts.statusHistory.data.datasets[0].data = data;
                    charts.statusHistory.data.datasets[0].backgroundColor = colors;
                    charts.statusHistory.update();
                    return;
                }
                charts.statusHistory = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } }
                        }
                    }
                });
            }
        };
    });
});
