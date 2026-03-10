const fs = require('fs');
const path = require('path');

// Extract title and subtitle from a markdown file
function parseMarkdownHeader(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let title = path.basename(filePath, '.md');
    let subtitle = '';

    for (const line of lines) {
        if (line.trim().startsWith('# ')) {
            title = line.substring(2).trim();
        } else if (line.trim().startsWith('Subtitle:')) {
            subtitle = line.substring(9).trim();
        }
        if (title !== path.basename(filePath, '.md') && subtitle) break;
    }
    return { title, subtitle };
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
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
        return `
            <div class="empty-state">
                <p>No project timelines have been added to this section yet.</p>
                <p><i>Add new <code>.md</code> files to <code>${dirPath}</code> to populate this list.</i></p>
            </div>`;
    }

    let html = '';
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        // Normalize path separators for the web
        const webPath = fullPath.replace(/\\/g, '/');
        const { title, subtitle } = parseMarkdownHeader(fullPath);
        html += createCardHtml(title, subtitle, webPath);
    }
    return html;
}

// Main Build Function
function buildIndex() {
    console.log('Building index.html...');
    
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
}

buildIndex();
