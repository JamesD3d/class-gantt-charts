document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('gantt-wrapper');
    if (!container) return;
    const url = container.getAttribute('data-src');
    if (!url) return;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const text = await response.text();
        renderGantt(text, container);
    } catch (e) {
        console.error('Failed to load markdown', e);
        container.innerHTML = '<p style="color:red; padding:2rem;">Failed to load data. See console.</p>';
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
                 html += `
                    <div class="${taskClasses}">
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
