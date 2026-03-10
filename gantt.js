document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('gantt-wrapper');
    if (!container) return;
    
    // First, check if there is a ?file= param in the URL (for viewer.html)
    const urlParams = new URLSearchParams(window.location.search);
    let url = urlParams.get('file');

    // If not, see if data-src is hardcoded (legacy support)
    if (!url) {
        url = container.getAttribute('data-src');
    }

    if (!url) {
        if (window.location.pathname.includes('viewer.html')) {
            container.innerHTML = '<p style="color:red; padding:2rem;">No project file specified in URL.</p>';
            document.getElementById('project-title').textContent = 'No Project Selected';
        }
        return;
    }
    
    // Set for subsequent access
    container.setAttribute('data-src', url);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const text = await response.text();
        renderGantt(text, container);
    } catch (e) {
        console.error('Failed to load markdown', e);
        container.innerHTML = '<p style="color:red; padding:2rem;">Failed to load data. Make sure the file exists.</p>';
        const titleEl = document.getElementById('project-title');
        if (titleEl) titleEl.textContent = 'Error Loading Project';
    }
});

function renderGantt(markdown, container) {
    const lines = markdown.split('\n');
    let title = '';
    let subtitle = '';
    let columns = [];
    let tasks = [];
    let currentTask = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith('# ')) {
            title = line.substring(2);
        } else if (line.startsWith('Subtitle:')) {
            subtitle = line.substring(9).trim();
        } else if (line.startsWith('Columns:')) {
            columns = line.substring(8).split(',').map(c => c.trim());
        } else if (line.startsWith('## ')) {
            if (currentTask) tasks.push(currentTask);
            currentTask = {
                name: line.substring(3).trim(),
                points: '',
                start: 1,
                duration: 1,
                label: '',
                tooltipTitle: '',
                bullets: []
            };
        } else if (currentTask) {
            if (line.startsWith('Points:')) currentTask.points = line.substring(7).trim();
            else if (line.startsWith('Start:')) currentTask.start = parseInt(line.substring(6).trim(), 10);
            else if (line.startsWith('Duration:')) currentTask.duration = parseInt(line.substring(9).trim(), 10);
            else if (line.startsWith('Label:')) currentTask.label = line.substring(6).trim();
            else if (line.startsWith('Tooltip:')) currentTask.tooltipTitle = line.substring(8).trim();
            else if (line.startsWith('- ')) currentTask.bullets.push(line.substring(2).trim());
        }
    }
    if (currentTask) tasks.push(currentTask);

    const titleEl = document.getElementById('project-title');
    if (titleEl) titleEl.textContent = title || 'Project Timeline';
    
    const subtitleEl = document.getElementById('project-subtitle');
    if (subtitleEl) subtitleEl.textContent = subtitle || 'Hover over tasks to see details.';

    let exportDiv = document.getElementById('export-container');
    if (!exportDiv) {
        exportDiv = document.createElement('div');
        exportDiv.id = 'export-container';
        exportDiv.className = 'export-btn-container';
        exportDiv.innerHTML = `<button class="export-btn" id="export-csv-btn" title="Export to Google Calendar, Outlook, etc.">📥 Export to Calendar (CSV)</button>`;
        container.insertBefore(exportDiv, document.getElementById('gantt-wrapper'));
        
        document.getElementById('export-csv-btn').addEventListener('click', () => {
            showExportModal(tasks, title || 'Project Timeline');
        });
    }

    // Build the grid
    let html = `<div class="gantt-grid" style="grid-template-columns: minmax(220px, 280px) repeat(${columns.length}, minmax(40px, 1fr));">\n`;
    
    // Header
    html += `<div class="gantt-header task-label">Deliverable / Task</div>\n`;
    for (let col of columns) {
        let parts = col.split(' ');
        let wk = parts.length > 1 ? parts.slice(1).join(' ') : '';
        html += `<div class="gantt-header day-label">${parts[0]} ${wk ? `<span class="day-label-wk">${wk}</span>` : ''}</div>\n`;
    }
    
    // Rows
    tasks.forEach((task, index) => {
        let taskClasses = `task-bar task-${(index % 8) + 1}`;
        
        // Edge cases for tooltip alignments to prevent edge clipping
        let tooltipAlignClass = '';
        if (task.start >= columns.length - 2) {
            tooltipAlignClass = 'align-right';
        } else if (task.duration > 3) {
            tooltipAlignClass = 'align-offset-left';
        }
        
        html += `<div class="gantt-row">\n`;
        html += `  <div class="gantt-cell task-name">${task.name} <span class="pts">${task.points}</span></div>\n`;
        
        for (let day = 1; day <= columns.length; day++) {
             html += `  <div class="gantt-cell day-cell">`;
             if (day === task.start) {
                 // Spanning multiple columns implies adding up pixel gaps (1px each)
                 let widthCalc = `calc(${task.duration * 100}% + ${task.duration - 1}px - 4px)`;
                 
                 html += `
                    <div class="${taskClasses}" style="width: ${widthCalc}; left: 2px;">
                        <span class="task-bar-text">${task.label}</span>
                        <div class="tooltip ${tooltipAlignClass}">
                            <strong>${task.tooltipTitle}</strong>
                            <ul>
                                ${task.bullets.map(b => `<li>${b}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                 `;
             }
             html += `</div>\n`;
        }
        
        html += `</div>\n`;
    });
    
    html += `</div>`;
    
    container.innerHTML = html;
}

// --- CSV Export Logic ---
function showExportModal(tasks, projectName) {
    let modalOverlay = document.getElementById('export-modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'export-modal-overlay';
        modalOverlay.className = 'export-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="export-modal">
                <h2>Export to Calendar</h2>
                <p>Configure how the grid aligns with real dates to export a CSV.</p>
                <div class="export-form-group">
                    <label>What date is Column 1?</label>
                    <input type="date" id="export-start-date" required>
                </div>
                <div class="export-form-group">
                    <label>What time does Column 1 start? (Optional)</label>
                    <input type="time" id="export-start-time" value="08:00">
                </div>
                <div class="export-form-group">
                    <label>Time Scale (1 Column = ?)</label>
                    <select id="export-scale">
                        <option value="1">1 Day</option>
                        <option value="0.041666667">1 Hour</option>
                        <option value="0.010416667">15 Minutes</option>
                    </select>
                </div>
                <div class="export-modal-footer">
                    <button class="export-btn" id="export-cancel-btn" style="border:none; color:var(--text-muted)">Cancel</button>
                    <button class="export-btn" id="export-confirm-btn" style="background:var(--color-1); color:white; border-color:var(--color-1)">Download CSV</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
        document.getElementById('export-start-date').valueAsDate = new Date();
    }
    
    modalOverlay.style.display = 'flex';
    
    document.getElementById('export-cancel-btn').onclick = () => {
        modalOverlay.style.display = 'none';
    };
    
    document.getElementById('export-confirm-btn').onclick = () => {
        generateCSV(tasks, projectName);
        modalOverlay.style.display = 'none';
    };
}

function generateCSV(tasks, projectName) {
    const startDateStr = document.getElementById('export-start-date').value;
    const startTimeStr = document.getElementById('export-start-time').value || '00:00';
    const scale = parseFloat(document.getElementById('export-scale').value);
    
    if (!startDateStr) {
        alert('Please select a start date.');
        return;
    }
    
    const baseDate = new Date(`${startDateStr}T${startTimeStr}:00`);
    let csvContent = "Subject,Start Date,Start Time,End Date,End Time,Description\n";
    
    tasks.forEach(task => {
        const startOffsetDays = (task.start - 1) * scale;
        const durationDays = task.duration * scale;
        
        const eventStart = new Date(baseDate.getTime() + startOffsetDays * 24 * 60 * 60 * 1000);
        const eventEnd = new Date(eventStart.getTime() + durationDays * 24 * 60 * 60 * 1000);
        
        const startDt = formatDate(eventStart);
        const startTm = formatTime(eventStart);
        const endDt = formatDate(eventEnd);
        const endTm = formatTime(eventEnd);
        
        // CSV Escaping
        const title = '"' + task.name.replace(/"/g, '""') + '"';
        const descText = task.bullets ? task.bullets.join('; ') : '';
        const desc = '"' + descText.replace(/"/g, '""') + '"';
        
        csvContent += `${title},${startDt},${startTm},${endDt},${endTm},${desc}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatDate(date) {
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${m}/${d}/${y}`;
}

function formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}:00`;
}
