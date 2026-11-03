import PDFDocument from 'pdfkit';

const PAGE = { width: 595, height: 842, left: 48, right: 547, top: 48, bottom: 790 };
const colors = { ink: '#172033', muted: '#526070', teal: '#0f766e', pale: '#ecfdf5', line: '#cbd5e1' };

const valueOr = (value, fallback = 'Not available') =>
  value === null || value === undefined || value === '' ? fallback : String(value);
const arrayOr = (value) => (Array.isArray(value) ? value : []);
const displayName = (node) => String(node?.label || node?.name || node?.id || 'Unnamed');

const addHeader = (doc, title, subtitle) => {
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(10).text('AIDOCINSIGHT', PAGE.left, 24);
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text('PROJECT ANALYSIS REPORT', 430, 25);
  doc.moveTo(PAGE.left, 38).lineTo(PAGE.right, 38).strokeColor(colors.line).stroke();
  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(22).text(title, PAGE.left, PAGE.top);
  if (subtitle) {
    doc.fillColor(colors.muted).font('Helvetica').fontSize(10).text(subtitle, PAGE.left, PAGE.top + 31);
  }
  doc.y = PAGE.top + (subtitle ? 58 : 42);
};

const addFooter = (doc, pageNumber) => {
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text(
    `AiDocInsight | Page ${pageNumber}`,
    PAGE.left,
    PAGE.bottom - 16,
    { align: 'right', width: PAGE.right - PAGE.left, lineBreak: false }
  );
};

const addParagraph = (doc, text, options = {}) => {
  doc.fillColor(options.color || colors.ink)
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 10)
    .text(String(text), { width: options.width || PAGE.right - PAGE.left, lineGap: options.lineGap || 3 });
  doc.moveDown(options.gap ?? 0.65);
};

const addBulletList = (doc, items) => items.forEach((item) => addParagraph(doc, `- ${item}`, { gap: 0.35 }));

const addKeyValueTable = (doc, rows) => {
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.roundedRect(PAGE.left, y, 150, 24, 3).fill(colors.pale);
    doc.roundedRect(PAGE.left + 154, y, PAGE.right - PAGE.left - 154, 24, 3).fill('#f8fafc');
    doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(9).text(label, PAGE.left + 8, y + 7);
    doc.fillColor(colors.ink).font('Helvetica').fontSize(9).text(valueOr(value), PAGE.left + 162, y + 7, { width: 325 });
    doc.y = y + 32;
  }
  doc.moveDown(0.4);
};

const addIssue = (doc, issue, index) => {
  const severity = issue.severity ? ` [${String(issue.severity).toUpperCase()}]` : '';
  doc.roundedRect(PAGE.left, doc.y, PAGE.right - PAGE.left, 92, 5).fill('#f8fafc');
  const start = doc.y + 10;
  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(11).text(`Issue ${index + 1}${severity}`, PAGE.left + 12, start);
  doc.font('Helvetica-Bold').fontSize(9).text('Description', PAGE.left + 12, start + 22);
  doc.font('Helvetica').text(valueOr(issue.message || issue.title || issue), PAGE.left + 90, start + 22, { width: 405 });
  doc.font('Helvetica-Bold').text('Path', PAGE.left + 12, start + 44);
  doc.font('Helvetica').text(valueOr(issue.path, 'Project-wide'), PAGE.left + 90, start + 44, { width: 405 });
  doc.font('Helvetica-Bold').text('Recommendation', PAGE.left + 12, start + 66);
  doc.font('Helvetica').text(valueOr(issue.recommendation, 'Review this finding with the related structure rules.'), PAGE.left + 105, start + 66, { width: 390 });
  doc.y = start + 104;
};

const addRecommendation = (doc, recommendation, index) => {
  const message = typeof recommendation === 'string' ? recommendation : recommendation.message || recommendation.title;
  doc.roundedRect(PAGE.left, doc.y, PAGE.right - PAGE.left, 78, 5).strokeColor(colors.line).stroke();
  const start = doc.y + 10;
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(11).text(`Recommendation ${index + 1}`, PAGE.left + 12, start);
  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(10).text(valueOr(message), PAGE.left + 12, start + 22, { width: 475 });
  doc.fillColor(colors.muted).font('Helvetica').fontSize(9).text(
    valueOr(typeof recommendation === 'string' ? null : recommendation.explanation, 'Derived from the stored project analysis findings.'),
    PAGE.left + 12,
    start + 42,
    { width: 475 }
  );
  doc.y = start + 92;
};

const diagramEndpoints = (data) => {
  const links = arrayOr(data?.relationships).concat(arrayOr(data?.edges), arrayOr(data?.flows));
  const storedNodes = arrayOr(data?.nodes).concat(arrayOr(data?.components));
  const names = new Map(storedNodes.map((node) => [displayName(node), { ...node, name: displayName(node) }]));
  for (const link of links) {
    const source = link.source || link.from || 'Source';
    const target = link.target || link.to || 'Target';
    if (!names.has(source)) names.set(source, { id: source, name: source });
    if (!names.has(target)) names.set(target, { id: target, name: target });
  }
  return { nodes: Array.from(names.values()).slice(0, 18), links };
};

const drawArrow = (doc, x1, y1, x2, y2) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 6;
  doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(colors.teal).lineWidth(1.2).stroke();
  doc.moveTo(x2, y2)
    .lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6))
    .lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6))
    .closePath().fill(colors.teal);
};

const drawDiagram = (doc, data, label) => {
  const { nodes, links } = diagramEndpoints(data);
  if (!nodes.length) {
    addParagraph(doc, `${label} data is not available in the saved analysis.`, { color: colors.muted });
    return;
  }
  const boxWidth = 130;
  const boxHeight = 42;
  const columns = 3;
  const positions = new Map();
  const diagramTop = doc.y + 8;
  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set(displayName(node), { x: PAGE.left + column * (boxWidth + 35), y: diagramTop + row * 76 });
  });
  for (const link of links) {
    const source = positions.get(link.source || link.from);
    const target = positions.get(link.target || link.to);
    if (source && target) drawArrow(doc, source.x + boxWidth / 2, source.y + boxHeight / 2, target.x + boxWidth / 2, target.y + boxHeight / 2);
  }
  for (const node of nodes) {
    const position = positions.get(displayName(node));
    doc.roundedRect(position.x, position.y, boxWidth, boxHeight, 5).fillAndStroke(colors.pale, colors.teal);
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(8).text(displayName(node), position.x + 7, position.y + 12, { width: boxWidth - 14, align: 'center' });
    if (node.type) doc.fillColor(colors.muted).font('Helvetica').fontSize(7).text(node.type, position.x + 7, position.y + 27, { width: boxWidth - 14, align: 'center' });
  }
  doc.y = diagramTop + Math.ceil(nodes.length / columns) * 76 + 12;
  addParagraph(doc, `${nodes.length} nodes and ${links.length} connections are rendered from the saved ${label.toLowerCase()} data.`, { color: colors.muted, size: 8 });
};

const addTestTable = (doc, testCases) => {
  const rows = arrayOr(testCases);
  const columns = [45, 190, 180, 84];
  const drawRow = (values, header = false) => {
    const y = doc.y;
    const height = header ? 26 : 38;
    let x = PAGE.left;
    values.forEach((value, index) => {
      doc.rect(x, y, columns[index], height).fillAndStroke(header ? colors.teal : '#f8fafc', colors.line);
      doc.fillColor(header ? '#ffffff' : colors.ink).font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(valueOr(value), x + 5, y + 8, { width: columns[index] - 10, height: height - 10 });
      x += columns[index];
    });
    doc.y = y + height;
  };
  drawRow(['ID', 'Test case', 'Expected result', 'Status'], true);
  rows.forEach((testCase) => drawRow([testCase.id, testCase.name, testCase.expected, testCase.status]));
  if (!rows.length) addParagraph(doc, 'No generated test cases are present in the saved analysis.', { color: colors.muted });
};

const chapter = (doc, number, title, content, state) => {
  if (state.page > 0) doc.addPage();
  state.page += 1;
  addHeader(doc, `Chapter ${number} - ${title}`, 'AiDocInsight completed project analysis');
  content();
  addFooter(doc, state.page);
};

export const createProjectReport = (result) => new Promise((resolve, reject) => {
  const analysis = result.analysis || {};
  const issues = arrayOr(result.issues || analysis.issues);
  const recommendations = arrayOr(result.aiAnalysis?.recommendations || result.recommendations || analysis.recommendations);
  const testCases = arrayOr(result.testCases);
  const technologies = arrayOr(analysis.detectedTechnologies);
  const rootEntries = arrayOr(analysis.projectRootStructure);
  const architecture = result.systemArchitecture || {};
  const dfd = result.dataFlowDiagram || {};
  const chunks = [];
  const state = { page: 0 };
  const doc = new PDFDocument({ size: 'A4', margins: { top: PAGE.top, bottom: 58, left: PAGE.left, right: 48 }, bufferPages: true });
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));

  chapter(doc, 1, 'Introduction', () => {
    addParagraph(doc, `AiDocInsight analyzes the uploaded project "${valueOr(result.projectName)}" and turns its stored structure findings into a readable engineering report.`);
    addParagraph(doc, 'The report combines project structure analysis, technology detection, health rating, recommendations, architecture, data flow, and generated test cases. Every project-specific value in this report comes from the saved Project analysis payload.');
  }, state);
  chapter(doc, 2, 'Summary of the Application', () => {
    addKeyValueTable(doc, [['Project', result.projectName], ['Project type', analysis.projectType], ['Technologies', technologies.join(', ')], ['Files', result.fileCount ?? analysis.fileCount], ['Extracted size', result.extractedSizeBytes ? `${result.extractedSizeBytes} bytes` : null], ['Major folders', rootEntries.filter((entry) => entry.type === 'directory').map((entry) => entry.name).join(', ')]]);
    addParagraph(doc, `The analysis completed with status ${valueOr(result.analysisStatus)} and found ${issues.length} issue(s) and ${recommendations.length} recommendation(s).`);
  }, state);
  chapter(doc, 3, 'Literature Survey', () => {
    addParagraph(doc, 'Software architecture analysis studies how components, boundaries, dependencies, and data movement affect maintainability. Static project analysis complements runtime testing by examining source layout, configuration, and technology signals without executing the uploaded application.');
    addParagraph(doc, 'AI-assisted software analysis extends these techniques by summarizing findings and proposing improvements. Automated documentation then makes those findings repeatable and useful for onboarding, review, and quality assessment.');
  }, state);
  chapter(doc, 4, 'Existing System', () => {
    addParagraph(doc, 'Manual project review requires an engineer to unpack archives, identify technologies, trace folders, inspect conventions, and document findings. This approach is slow, inconsistent across reviewers, and difficult to reproduce when a project changes.');
    addParagraph(doc, 'Without a shared report, issues and recommendations can remain scattered across notes and the relationship between structure findings and quality decisions is hard to audit.');
  }, state);
  chapter(doc, 5, 'Proposed System', () => {
    addBulletList(doc, ['ZIP upload and secure extraction', 'Technology detection from project files and dependencies', 'Structure analysis with issues and recommendations', 'Health rating and grade calculation', 'Architecture and data-flow generation from stored analysis', 'Test-case generation and multi-page PDF report generation']);
  }, state);
  chapter(doc, 6, 'System Requirements', () => {
    addParagraph(doc, 'Functional requirements');
    addBulletList(doc, ['Authenticated users can upload a ZIP project.', 'The system extracts and analyzes the project structure.', 'The dashboard displays completed projects and health summaries.', 'The analysis page displays findings, diagrams, recommendations, and test cases.', 'Users can download a PDF report for a completed analysis.']);
    addParagraph(doc, 'Non-functional requirements');
    addBulletList(doc, ['Analysis results remain tied to the authenticated project owner.', 'The report remains readable when content spans multiple pages.', 'Generated diagrams use the saved analysis relationships.', 'Unavailable fields are not replaced with invented project findings.']);
  }, state);
  chapter(doc, 7, 'Software and Hardware Requirements', () => {
    addKeyValueTable(doc, [['Frontend', 'React, React Router, Vite'], ['Backend', 'Node.js, Express, Mongoose'], ['Database', 'MongoDB'], ['Analysis libraries', 'Existing AiDocInsight structure analyzer'], ['Report library', 'PDFKit'], ['Runtime', 'Node.js 20 or compatible version'], ['Hardware', 'Modern multi-core processor, 4 GB RAM minimum, available storage for extracted ZIPs, and local network access between frontend and API']]);
  }, state);
  chapter(doc, 8, 'System Architecture', () => {
    addParagraph(doc, 'This diagram is rendered from systemArchitecture.nodes and systemArchitecture.relationships stored for this project.');
    drawDiagram(doc, architecture, 'system architecture');
  }, state);
  chapter(doc, 9, 'Data Flow', () => {
    addParagraph(doc, 'This diagram is rendered from dataFlowDiagram nodes and flows stored for this project.');
    drawDiagram(doc, dfd, 'data flow');
  }, state);
  chapter(doc, 10, 'Application Code', () => {
    addParagraph(doc, 'This chapter summarizes the analyzed codebase rather than embedding the entire uploaded source archive.');
    addKeyValueTable(doc, [['Detected technologies', technologies.join(', ')], ['Important files', arrayOr(analysis.importantFileTypes).join(', ')], ['Folders', analysis.folderCount], ['Files', analysis.fileCount ?? result.fileCount], ['File extensions', Object.keys(analysis.fileExtensions || {}).join(', ')]]);
    addParagraph(doc, `The stored folder tree contains ${rootEntries.length} root entries and is available in the analysis dashboard.`);
    addParagraph(doc, 'Issues Found', { bold: true, size: 13, color: colors.teal });
    if (issues.length) issues.forEach((issue, index) => addIssue(doc, issue, index));
    else addParagraph(doc, 'No issues were recorded in the saved analysis.', { color: colors.muted });
    addParagraph(doc, 'AI Recommendations', { bold: true, size: 13, color: colors.teal });
    if (recommendations.length) recommendations.forEach((recommendation, index) => addRecommendation(doc, recommendation, index));
    else addParagraph(doc, 'No recommendations were recorded in the saved analysis.', { color: colors.muted });
  }, state);
  chapter(doc, 11, 'Test Cases', () => {
    addParagraph(doc, 'Generated test cases are shown individually using the saved testCases data.');
    addTestTable(doc, testCases);
  }, state);
  chapter(doc, 12, 'Conclusion', () => {
    addParagraph(doc, `The project received a health rating of ${valueOr(result.rating)} / 100 with grade ${valueOr(result.grade)}. The structure analyzer detected ${issues.length} issue(s) and ${recommendations.length} recommendation(s).`);
    addParagraph(doc, 'The assessment should be used as a focused starting point for remediation, architecture review, and follow-up testing.');
  }, state);
  chapter(doc, 13, 'Future Scope', () => {
    addBulletList(doc, ['Add deeper dependency and call-graph analysis.', 'Support richer architecture layouts for large projects.', 'Add configurable quality rules and historical rating comparisons.', 'Add runtime and integration evidence alongside static analysis.', 'Expand report export with source-linked findings and visual legends.']);
  }, state);
  chapter(doc, 14, 'References', () => {
    addBulletList(doc, ['React and Vite project documentation for frontend architecture.', 'Node.js and Express documentation for HTTP service design.', 'MongoDB and Mongoose documentation for project persistence.', 'PDFKit documentation for programmatic PDF documents and vector drawing.', 'Static analysis and software architecture quality assessment literature.']);
  }, state);
  doc.end();
});
