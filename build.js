const fs = require('fs');
const path = require('path');

// Extract title and subtitle from a markdown file
function parseMarkdownHeader(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let title = path.basename(filePath, '.md');
    let subtitle = '';
    let order = 999; // Default order if not specified

    for (const line of lines) {
        if (line.trim().startsWith('# ')) {
            title = line.substring(2).trim();
        } else if (line.trim().startsWith('Subtitle:')) {
            subtitle = line.substring(9).trim();
        } else if (line.trim().startsWith('Order:')) {
            const parsedOrder = parseInt(line.substring(6).trim(), 10);
            if (!isNaN(parsedOrder)) order = parsedOrder;
        } else if (line.trim().startsWith('Columns:') || line.trim().startsWith('## ')) {
            break;
        }
    }
    return { title, subtitle, order };
}

// Generate the HTML for a single project card
function createCardHtml(title, subtitle, mdFilePath) {
    // Generate the URL to open this file in the viewer
    const viewerUrl = `viewer.html?file=${encodeURI(mdFilePath)}`;
    
    return `
            <a href="${viewerUrl}" class="project-card">
                <div class="project-info">
                    <h2>${title}</h2>
                    <p>${subtitle}</p>
                </div>
                <div class="arrow">→</div>
            </a>`;
}

// Scan a directory for .md files and build HTML cards
function buildSection(dirPath) {
    if (!fs.existsSync(dirPath)) return '';
    
    let files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
    
    // Read and parse all files
    let fileData = files.map(file => {
        const fullPath = path.join(dirPath, file);
        const webPath = fullPath.replace(/\\/g, '/');
        const headerInfo = parseMarkdownHeader(fullPath);
        const stats = fs.statSync(fullPath);
        return { 
            file, 
            webPath, 
            mtimeMs: stats.mtimeMs, 
            ...headerInfo 
        };
    });

    // Sort files by Order first (ascending), then fallback to newest modification time
    fileData.sort((a, b) => {
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        return b.mtimeMs - a.mtimeMs;
    });

    if (fileData.length === 0) {
        return `
            <div class="empty-state">
                <p>No project timelines have been added to this section yet.</p>
                <p><i>Add new <code>.md</code> files to <code>${dirPath}</code> to populate this list.</i></p>
            </div>`;
    }

    let html = '';
    for (const data of fileData) {
        html += createCardHtml(data.title, data.subtitle, data.webPath);
    }
    return html;
}

// Main Build Function
function buildIndex() {
    console.log(`[${new Date().toLocaleTimeString()}] Building index.html...`);
    
    try {
        // Find all root level directories that might be teachers/categories
        const excludes = ['.git', '.github', 'node_modules', 'projects', 'brain', 'scratch', 'tmp'];
        const rootDirs = fs.readdirSync(__dirname, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && !excludes.includes(dirent.name) && !dirent.name.startsWith('.'))
            .map(dirent => dirent.name);

        let generatedHtml = '';

        for (const rootDir of rootDirs) {
            generatedHtml += `<div class="teacher-section" style="margin-top: 3rem;">\n`;
            generatedHtml += `  <h2 style="border-bottom: 2px solid var(--color-1); padding-bottom: 0.5rem; color: var(--color-1);">${rootDir}</h2>\n`;
            
            // Find subdirectories inside this rootDir
            const rootPath = path.join(__dirname, rootDir);
            const subDirs = fs.readdirSync(rootPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            if (subDirs.length === 0) {
                 generatedHtml += `  <p style="color: var(--text-muted); margin-top: 1rem;">No class folders found.</p>\n</div>\n`;
                 continue;
            }

            // Create Tabs Container
            generatedHtml += `  <div class="tabs" style="margin-top: 1rem;">\n`;
            subDirs.forEach((subDir, index) => {
                const activeClass = index === 0 ? 'active' : '';
                // Nice name formatting (e.g. tech-eng-design -> Tech Eng Design)
                const tabName = subDir.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const tabId = `${rootDir}-${subDir}`.replace(/[^a-zA-Z0-9]/g, '-');
                generatedHtml += `      <button class="tab-btn ${activeClass}" onclick="switchTab(this, '${tabId}')">${tabName}</button>\n`;
            });
            generatedHtml += `  </div>\n`;

            // Create Tab Contents
            subDirs.forEach((subDir, index) => {
                const activeClass = index === 0 ? 'active' : '';
                const tabId = `${rootDir}-${subDir}`.replace(/[^a-zA-Z0-9]/g, '-');
                const sectionPath = path.join(rootDir, subDir).replace(/\\/g, '/');
                const cardsHtml = buildSection(sectionPath);
                
                generatedHtml += `  <div id="${tabId}" class="tab-content ${activeClass}">\n`;
                generatedHtml += `      <div class="project-list">\n`;
                generatedHtml += cardsHtml;
                generatedHtml += `      </div>\n`;
                generatedHtml += `  </div>\n`;
            });

            generatedHtml += `</div>\n`;
        }

        // Load the base index.html template
        let indexHtml = fs.readFileSync('index.html', 'utf-8');

        // Replace everything between the markers with the new dynamic content
        indexHtml = indexHtml.replace(
            /<!-- BLOCK:DYNAMIC_CONTENT -->[\s\S]*?<!-- ENDBLOCK:DYNAMIC_CONTENT -->/,
            `<!-- BLOCK:DYNAMIC_CONTENT -->\n${generatedHtml}\n    <!-- ENDBLOCK:DYNAMIC_CONTENT -->`
        );

        fs.writeFileSync('index.html', indexHtml);
        console.log('index.html generated successfully.');
    } catch (error) {
        console.error('Error building index:', error);
    }
}

// Watch Mode Implementation
if (process.argv.includes('--watch')) {
    console.log('Starting in watch mode...');
    buildIndex();

    // Debounce function to avoid multiple rapid builds
    let timeout;
    const debouncedBuild = () => {
        clearTimeout(timeout);
        timeout = setTimeout(buildIndex, 100);
    };

    // Watch for changes in the directory
    // Note: Recursive watching is supported on Windows
    fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        // Only trigger build for relevant files
        if (filename.endsWith('.md') || filename === 'index.html' || filename === 'gantt.js') {
            // Avoid infinite loops if build.js updates index.html
            if (filename === 'index.html' && eventType === 'change') {
                // We check if it was recently modified by us in some way? 
                // Actually, fs.watch is fine because we're debouncing and the change event is usually quick.
            }
            
            // Don't watch internal folders
            const excludes = ['.git', '.github', 'node_modules', 'brain', 'scratch', 'tmp'];
            if (excludes.some(exclude => filename.includes(exclude))) return;

            console.log(`File changed: ${filename}`);
            debouncedBuild();
        }
    });
} else {
    buildIndex();
}
