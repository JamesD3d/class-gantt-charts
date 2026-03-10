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
    const viewerUrl = `viewer.html?file=${encodeURIComponent(mdFilePath)}`;
    
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

    // Read the directories
    const techEngCards = buildSection('projects/tech-eng-design');
    const engDesignCards = buildSection('projects/eng-design');
    const templateCards = buildSection('templates');

    // Load the base index.html template
    let indexHtml = fs.readFileSync('index.html', 'utf-8');

    // We will use special marker comments in the index.html to know where to inject the cards
    indexHtml = indexHtml.replace(
        /<!-- BLOCK:tech-eng-design -->[\s\S]*?<!-- ENDBLOCK:tech-eng-design -->/,
        `<!-- BLOCK:tech-eng-design -->\n${techEngCards}\n            <!-- ENDBLOCK:tech-eng-design -->`
    );

    indexHtml = indexHtml.replace(
        /<!-- BLOCK:eng-design -->[\s\S]*?<!-- ENDBLOCK:eng-design -->/,
        `<!-- BLOCK:eng-design -->\n${engDesignCards}\n            <!-- ENDBLOCK:eng-design -->`
    );

    indexHtml = indexHtml.replace(
        /<!-- BLOCK:templates -->[\s\S]*?<!-- ENDBLOCK:templates -->/,
        `<!-- BLOCK:templates -->\n${templateCards}\n            <!-- ENDBLOCK:templates -->`
    );

    fs.writeFileSync('index.html', indexHtml);
    console.log('index.html generated successfully.');
}

buildIndex();
