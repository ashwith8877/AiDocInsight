import fs from 'fs/promises';
import path from 'path';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.svn',
  '.hg',
  '__pycache__',
  '.idea',
  '.vscode',
  '.next',
  '.nuxt',
  'target',
  'venv',
  '.venv',
  'env',
]);

const IMPORTANT_FILE_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'manage.py',
  'requirements.txt',
  'pyproject.toml',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'readme.md',
  'readme',
  '.env.example',
  'tsconfig.json',
  'vite.config.js',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs',
  'angular.json',
  'composer.json',
  'go.mod',
  'cargo.toml',
]);

const IMPORTANT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
  '.json',
  '.html',
  '.css',
  '.scss',
  '.yml',
  '.yaml',
  '.xml',
  '.md',
  '.sql',
  '.env',
]);

const toPosix = (value) => value.split(path.sep).join('/');

const safeReadJson = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * If extraction produced a single top-level folder, treat that as the project root.
 */
export const resolveAnalysisRoot = async (extractedPath) => {
  const entries = await fs.readdir(extractedPath, { withFileTypes: true });
  const meaningful = entries.filter(
    (entry) => entry.name !== '__MACOSX' && entry.name !== '.DS_Store'
  );

  if (meaningful.length === 1 && meaningful[0].isDirectory()) {
    return path.join(extractedPath, meaningful[0].name);
  }

  return extractedPath;
};

const walkDirectory = async (rootDir) => {
  const files = [];
  const folders = [];

  const walk = async (currentDir, relativeDir = '') => {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === '.DS_Store' || entry.name === '__MACOSX') {
        continue;
      }

      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) {
          continue;
        }
        folders.push({
          name: entry.name,
          path: toPosix(relativePath),
        });
        await walk(absolutePath, relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      files.push({
        name: entry.name,
        path: toPosix(relativePath),
        extension: extension || '(none)',
        sizeBytes: (await fs.stat(absolutePath)).size,
      });
    }
  };

  await walk(rootDir);
  return { files, folders };
};

const buildTree = (files, folders) => {
  const root = { name: '.', type: 'directory', children: [] };
  const ensureDir = (segments) => {
    let node = root;
    for (const segment of segments) {
      let child = node.children.find(
        (item) => item.type === 'directory' && item.name === segment
      );
      if (!child) {
        child = { name: segment, type: 'directory', children: [] };
        node.children.push(child);
      }
      node = child;
    }
    return node;
  };

  for (const folder of folders) {
    ensureDir(folder.path.split('/').filter(Boolean));
  }

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    const fileName = parts.pop();
    const parent = ensureDir(parts);
    parent.children.push({
      name: fileName,
      type: 'file',
      extension: file.extension,
    });
  }

  const sortTree = (node) => {
    if (!node.children) return node;
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
    return node;
  };

  return sortTree(root);
};

const buildFolderTree = (folders) => {
  const root = { name: '.', type: 'directory', children: [] };
  const ensureDir = (segments) => {
    let node = root;
    for (const segment of segments) {
      let child = node.children.find((item) => item.name === segment);
      if (!child) {
        child = { name: segment, type: 'directory', children: [] };
        node.children.push(child);
      }
      node = child;
    }
    return node;
  };

  for (const folder of folders) {
    ensureDir(folder.path.split('/').filter(Boolean));
  }

  return root;
};

const collectExtensions = (files) => {
  const extensions = {};
  for (const file of files) {
    extensions[file.extension] = (extensions[file.extension] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(extensions).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
};

const collectImportantFileTypes = (files) => {
  const important = new Set();

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (IMPORTANT_FILE_NAMES.has(lower)) {
      important.add(file.name);
    }
    if (IMPORTANT_EXTENSIONS.has(file.extension)) {
      important.add(file.extension);
    }
  }

  return Array.from(important).sort((a, b) => a.localeCompare(b));
};

const hasPath = (items, matcher) =>
  items.some((item) =>
    typeof matcher === 'string' ? item.path === matcher || item.name === matcher : matcher(item)
  );

const hasFolder = (folders, nameOrPath) =>
  folders.some(
    (folder) =>
      folder.name.toLowerCase() === nameOrPath.toLowerCase() ||
      folder.path.toLowerCase() === nameOrPath.toLowerCase()
  );

const detectTechnologies = async (analysisRoot, files, folders) => {
  const technologies = new Set();
  const signals = {
    react: false,
    express: false,
    mongoose: false,
    mongodb: false,
    vite: false,
    next: false,
    spring: false,
    django: false,
    python: false,
    java: false,
    html: false,
  };

  const packageJsonFiles = files.filter((file) => file.name === 'package.json');
  for (const pkgFile of packageJsonFiles) {
    const pkg = await safeReadJson(path.join(analysisRoot, pkgFile.path));
    if (!pkg) continue;

    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    if (deps.react) {
      signals.react = true;
      technologies.add('React');
    }
    if (deps.express) {
      signals.express = true;
      technologies.add('Express');
      technologies.add('Node.js');
    }
    if (deps.mongoose) {
      signals.mongoose = true;
      technologies.add('Mongoose');
    }
    if (deps.mongodb) {
      signals.mongodb = true;
      technologies.add('MongoDB');
    }
    if (deps.vite || files.some((f) => f.name.startsWith('vite.config.'))) {
      signals.vite = true;
      technologies.add('Vite');
    }
    if (deps.next || files.some((f) => f.name.startsWith('next.config.'))) {
      signals.next = true;
      technologies.add('Next.js');
    }
    if (!deps.express && (pkg.type === 'module' || pkg.main || pkg.scripts)) {
      technologies.add('Node.js');
    }
  }

  if (hasPath(files, (f) => f.name === 'pom.xml' || f.name.startsWith('build.gradle'))) {
    signals.java = true;
    technologies.add('Java');
  }

  if (
    hasPath(files, (f) => f.name === 'pom.xml') ||
    files.some((f) => f.path.includes('src/main/java'))
  ) {
    const javaFiles = files.filter((f) => f.extension === '.java').slice(0, 20);
    for (const javaFile of javaFiles) {
      try {
        const content = await fs.readFile(path.join(analysisRoot, javaFile.path), 'utf8');
        if (/org\.springframework|spring-boot/i.test(content)) {
          signals.spring = true;
          technologies.add('Spring Boot');
          break;
        }
      } catch {
        // ignore unreadable files
      }
    }
    if (await fileExists(path.join(analysisRoot, 'pom.xml'))) {
      try {
        const pom = await fs.readFile(path.join(analysisRoot, 'pom.xml'), 'utf8');
        if (/spring-boot/i.test(pom)) {
          signals.spring = true;
          technologies.add('Spring Boot');
        }
      } catch {
        // ignore
      }
    }
  }

  if (hasPath(files, 'manage.py') || hasPath(files, 'settings.py')) {
    signals.django = true;
    signals.python = true;
    technologies.add('Django');
    technologies.add('Python');
  }

  if (
    hasPath(files, 'requirements.txt') ||
    hasPath(files, 'pyproject.toml') ||
    files.some((f) => f.extension === '.py')
  ) {
    signals.python = true;
    technologies.add('Python');
  }

  if (files.some((f) => f.extension === '.html')) {
    signals.html = true;
    technologies.add('HTML');
  }
  if (files.some((f) => ['.css', '.scss'].includes(f.extension))) {
    technologies.add('CSS');
  }

  if (
    hasFolder(folders, 'client') ||
    hasFolder(folders, 'frontend') ||
    hasFolder(folders, 'server') ||
    hasFolder(folders, 'backend')
  ) {
    technologies.add('Full-stack layout');
  }

  return { technologies: Array.from(technologies).sort(), signals };
};

const resolveProjectType = (signals, technologies) => {
  if (
    (signals.react && signals.express && (signals.mongoose || signals.mongodb)) ||
    (signals.react &&
      signals.express &&
      technologies.includes('Full-stack layout') &&
      (signals.mongoose || signals.mongodb))
  ) {
    return 'MERN';
  }

  if (signals.spring || (signals.java && technologies.includes('Spring Boot'))) {
    return 'Java/Spring Boot';
  }

  if (signals.django) {
    return 'Python/Django';
  }

  if (signals.react && !signals.express) {
    return 'React';
  }

  if (signals.express || (technologies.includes('Node.js') && signals.express)) {
    return 'Node/Express';
  }

  if (signals.react && signals.express) {
    return 'MERN';
  }

  if (signals.html || technologies.includes('HTML')) {
    return 'Generic web application';
  }

  if (signals.python) {
    return 'Python/Django';
  }

  if (signals.java) {
    return 'Java/Spring Boot';
  }

  return 'Unknown';
};

const expectedStructures = {
  MERN: {
    folders: ['client or frontend', 'server or backend', 'server/models', 'server/routes', 'server/controllers'],
    files: ['package.json', 'README.md', '.env.example'],
    notes: 'Separate client and server apps with clear MVC/service boundaries on the API side.',
  },
  React: {
    folders: ['src', 'public', 'src/components'],
    files: ['package.json', 'src/App.jsx or src/App.tsx', 'index.html or public/index.html'],
    notes: 'Keep UI components, pages/hooks, and assets organized under src/.',
  },
  'Node/Express': {
    folders: ['src or root modules', 'routes', 'controllers', 'models', 'middleware'],
    files: ['package.json', 'server.js/app.js or src/server.js'],
    notes: 'Prefer layered folders (routes → controllers → services → models).',
  },
  'Java/Spring Boot': {
    folders: ['src/main/java', 'src/main/resources', 'src/test/java'],
    files: ['pom.xml or build.gradle', 'application.properties or application.yml'],
    notes: 'Follow standard Maven/Gradle layout with packages for controller/service/repository.',
  },
  'Python/Django': {
    folders: ['project package', 'apps/', 'templates/', 'static/'],
    files: ['manage.py', 'settings.py', 'urls.py', 'requirements.txt or pyproject.toml'],
    notes: 'Keep settings, urls, and apps separated; avoid putting business logic only in views without services/forms where needed.',
  },
  'Generic web application': {
    folders: ['css or styles', 'js or scripts', 'images or assets'],
    files: ['index.html'],
    notes: 'Group static assets by type and avoid dumping all files in the root.',
  },
  Unknown: {
    folders: [],
    files: ['README.md'],
    notes: 'Add a README and organize source into clearly named folders for the stack you use.',
  },
};

const pushIssue = (issues, issue) => {
  issues.push({
    code: issue.code,
    severity: issue.severity || 'medium',
    message: issue.message,
    path: issue.path || null,
  });
};

const pushRecommendation = (recommendations, message) => {
  if (!recommendations.includes(message)) {
    recommendations.push(message);
  }
};

const analyzeStructureRules = ({
  projectType,
  files,
  folders,
  projectRootStructure,
  signals,
}) => {
  const issues = [];
  const recommendations = [];
  const rootFiles = files.filter((file) => !file.path.includes('/'));
  const folderNames = new Set(folders.map((folder) => folder.name.toLowerCase()));
  const rootFolderNames = new Set(
    projectRootStructure.filter((item) => item.type === 'directory').map((item) => item.name.toLowerCase())
  );

  const hasAnyFolder = (...names) => names.some((name) => folderNames.has(name.toLowerCase()));
  const hasRootFolder = (...names) => names.some((name) => rootFolderNames.has(name.toLowerCase()));

  // Unnecessary / noisy folders
  for (const folder of folders) {
    if (['__macosx', 'tmp', 'temp', '.tmp'].includes(folder.name.toLowerCase())) {
      pushIssue(issues, {
        code: 'UNNECESSARY_FOLDER',
        severity: 'low',
        message: `Unnecessary folder detected: ${folder.path}`,
        path: folder.path,
      });
      pushRecommendation(recommendations, 'Remove temporary or OS metadata folders from source archives.');
    }
  }

  // Naming problems
  for (const folder of folders) {
    if (/\s/.test(folder.name)) {
      pushIssue(issues, {
        code: 'NAMING_SPACE',
        severity: 'low',
        message: `Folder name contains spaces: ${folder.path}`,
        path: folder.path,
      });
      pushRecommendation(
        recommendations,
        'Prefer kebab-case or snake_case folder names without spaces.'
      );
    }
  }

  for (const file of rootFiles) {
    if (/\s/.test(file.name) && !/^readme(\..+)?$/i.test(file.name)) {
      pushIssue(issues, {
        code: 'ROOT_FILE_NAMING',
        severity: 'low',
        message: `Root file name contains spaces: ${file.name}`,
        path: file.path,
      });
    }
  }

  // Secrets accidentally included
  for (const file of files) {
    if (file.name === '.env' || /(^|\/)\.env$/i.test(file.path)) {
      pushIssue(issues, {
        code: 'SECRET_ENV_FILE',
        severity: 'high',
        message: 'A .env file was found in the project archive. Secrets should not be committed or uploaded.',
        path: file.path,
      });
      pushRecommendation(recommendations, 'Keep secrets out of uploads; ship only .env.example.');
    }
  }

  // Misplaced source files at root when src exists
  if (hasAnyFolder('src')) {
    const misplaced = rootFiles.filter((file) =>
      ['.js', '.jsx', '.ts', '.tsx', '.py', '.java'].includes(file.extension)
    );
    for (const file of misplaced) {
      if (/^(app|server|index|main)\./i.test(file.name)) {
        continue;
      }
      pushIssue(issues, {
        code: 'MISPLACED_SOURCE_FILE',
        severity: 'medium',
        message: `Source file at project root while src/ exists: ${file.name}`,
        path: file.path,
      });
    }
    if (misplaced.length) {
      pushRecommendation(recommendations, 'Keep application source under src/ (or an app package) instead of the root.');
    }
  }

  if (projectType === 'MERN') {
    if (!hasRootFolder('client', 'frontend') && !hasAnyFolder('client') && !hasAnyFolder('frontend')) {
      pushIssue(issues, {
        code: 'MISSING_CLIENT',
        severity: 'high',
        message: 'MERN projects typically include a client/ or frontend/ folder.',
      });
    }
    if (!hasRootFolder('server', 'backend', 'api') && !hasAnyFolder('server') && !hasAnyFolder('backend')) {
      pushIssue(issues, {
        code: 'MISSING_SERVER',
        severity: 'high',
        message: 'MERN projects typically include a server/, backend/, or api/ folder.',
      });
    }
    if (!hasAnyFolder('models') && !hasAnyFolder('model')) {
      pushIssue(issues, {
        code: 'MISSING_MODELS',
        severity: 'medium',
        message: 'No models/ folder found for data layer separation.',
      });
    }
    if (!hasAnyFolder('routes') && !hasAnyFolder('controllers')) {
      pushIssue(issues, {
        code: 'MISSING_API_LAYERS',
        severity: 'medium',
        message: 'Missing routes/ and controllers/ folders reduces separation of concerns for the API.',
      });
    }
    pushRecommendation(
      recommendations,
      'Use distinct frontend and backend packages, with backend layers for routes, controllers, services, and models.'
    );
  }

  if (projectType === 'React') {
    if (!hasAnyFolder('src')) {
      pushIssue(issues, {
        code: 'MISSING_SRC',
        severity: 'high',
        message: 'React projects usually include a src/ directory.',
      });
    }
    if (!hasAnyFolder('components') && !hasAnyFolder('pages')) {
      pushIssue(issues, {
        code: 'MISSING_UI_STRUCTURE',
        severity: 'medium',
        message: 'No components/ or pages/ folders found for UI organization.',
      });
    }
    if (!files.some((f) => /^package\.json$/i.test(f.name))) {
      pushIssue(issues, {
        code: 'MISSING_PACKAGE_JSON',
        severity: 'high',
        message: 'package.json is missing.',
      });
    }
    pushRecommendation(recommendations, 'Organize React code into components, pages/hooks, and services under src/.');
  }

  if (projectType === 'Node/Express') {
    if (!hasAnyFolder('routes') && !hasAnyFolder('src')) {
      pushIssue(issues, {
        code: 'MISSING_ROUTES',
        severity: 'medium',
        message: 'Express apps typically expose a routes/ folder (or src/routes).',
      });
    }
    if (hasAnyFolder('routes') && !hasAnyFolder('controllers') && !hasAnyFolder('services')) {
      pushIssue(issues, {
        code: 'WEAK_LAYERING',
        severity: 'medium',
        message: 'Routes exist without controllers/services — business logic may be mixed into route handlers.',
      });
      pushRecommendation(
        recommendations,
        'Introduce controllers and services so routes stay thin and concerns stay separated.'
      );
    }
  }

  if (projectType === 'Java/Spring Boot') {
    if (!hasAnyFolder('java') && !files.some((f) => f.path.includes('src/main/java'))) {
      pushIssue(issues, {
        code: 'MISSING_JAVA_SRC',
        severity: 'high',
        message: 'Expected src/main/java layout for Spring Boot projects.',
      });
    }
    if (!hasAnyFolder('resources') && !files.some((f) => f.path.includes('src/main/resources'))) {
      pushIssue(issues, {
        code: 'MISSING_RESOURCES',
        severity: 'medium',
        message: 'Expected src/main/resources for configuration and static assets.',
      });
    }
    if (!files.some((f) => /^(pom\.xml|build\.gradle(\.kts)?)$/i.test(f.name))) {
      pushIssue(issues, {
        code: 'MISSING_BUILD_FILE',
        severity: 'high',
        message: 'Missing pom.xml or build.gradle for Java builds.',
      });
    }
  }

  if (projectType === 'Python/Django') {
    if (!files.some((f) => f.name === 'manage.py')) {
      pushIssue(issues, {
        code: 'MISSING_MANAGE_PY',
        severity: 'high',
        message: 'manage.py not found for Django project.',
      });
    }
    if (!files.some((f) => f.name === 'settings.py')) {
      pushIssue(issues, {
        code: 'MISSING_SETTINGS',
        severity: 'high',
        message: 'settings.py not found.',
      });
    }
    if (!files.some((f) => f.name === 'urls.py')) {
      pushIssue(issues, {
        code: 'MISSING_URLS',
        severity: 'medium',
        message: 'urls.py not found.',
      });
    }
    pushRecommendation(recommendations, 'Keep Django apps modular with models, views, urls, and serializers/services as needed.');
  }

  if (projectType === 'Generic web application') {
    if (!files.some((f) => f.name.toLowerCase() === 'index.html')) {
      pushIssue(issues, {
        code: 'MISSING_INDEX',
        severity: 'medium',
        message: 'No index.html entry point found.',
      });
    }
    if (rootFiles.filter((f) => ['.css', '.js', '.html'].includes(f.extension)).length > 8) {
      pushIssue(issues, {
        code: 'FLAT_ROOT',
        severity: 'medium',
        message: 'Many web assets live in the project root instead of grouped folders.',
      });
      pushRecommendation(recommendations, 'Move CSS, JS, and images into dedicated folders.');
    }
  }

  // Separation of concerns: giant dump of files in one folder
  const filesByParent = {};
  for (const file of files) {
    const parent = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '.';
    filesByParent[parent] = (filesByParent[parent] || 0) + 1;
  }
  for (const [parent, count] of Object.entries(filesByParent)) {
    if (count >= 40) {
      pushIssue(issues, {
        code: 'OVERLOADED_FOLDER',
        severity: 'medium',
        message: `Folder contains many files (${count}): ${parent}`,
        path: parent,
      });
      pushRecommendation(recommendations, 'Split large directories by feature or layer to improve maintainability.');
    }
  }

  // Architecture: controllers without models or vice versa for node-like apps
  if ((signals.express || projectType === 'MERN' || projectType === 'Node/Express') &&
      hasAnyFolder('controllers') &&
      !hasAnyFolder('models') &&
      !hasAnyFolder('model')) {
    pushIssue(issues, {
      code: 'CONTROLLER_WITHOUT_MODEL',
      severity: 'low',
      message: 'controllers/ present without models/ — data access may be unstructured.',
    });
  }

  if (!files.some((f) => /^readme(\.md|\.txt)?$/i.test(f.name))) {
    pushIssue(issues, {
      code: 'MISSING_README',
      severity: 'low',
      message: 'No README file found at the project root.',
    });
    pushRecommendation(recommendations, 'Add a README describing setup, stack, and folder structure.');
  }

  if (!issues.length) {
    pushRecommendation(recommendations, 'Structure looks reasonable for the detected stack; keep documenting conventions as the project grows.');
  }

  return { issues, recommendations };
};

/**
 * Analyze an extracted project directory and return structured results.
 */
export const analyzeProjectStructure = async (extractedPath) => {
  const analysisRoot = await resolveAnalysisRoot(extractedPath);
  const { files, folders } = await walkDirectory(analysisRoot);

  const rootEntries = await fs.readdir(analysisRoot, { withFileTypes: true });
  const projectRootStructure = rootEntries
    .filter((entry) => entry.name !== '.DS_Store' && entry.name !== '__MACOSX')
    .filter((entry) => !(entry.isDirectory() && SKIP_DIR_NAMES.has(entry.name)))
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const fileExtensions = collectExtensions(files);
  const importantFileTypes = collectImportantFileTypes(files);
  const { technologies, signals } = await detectTechnologies(analysisRoot, files, folders);
  const projectType = resolveProjectType(signals, technologies);
  const { issues, recommendations } = analyzeStructureRules({
    projectType,
    files,
    folders,
    projectRootStructure,
    signals,
  });

  const fileTree = buildTree(files, folders);
  const folderTree = buildFolderTree(folders);

  return {
    projectType,
    analysisRootName: path.basename(analysisRoot),
    fileTree,
    folderTree,
    folderCount: folders.length,
    fileCount: files.length,
    fileExtensions,
    importantFileTypes,
    projectRootStructure,
    detectedTechnologies: technologies,
    issues,
    recommendations,
    expectedStructure: expectedStructures[projectType] || expectedStructures.Unknown,
    analyzedAt: new Date(),
  };
};
