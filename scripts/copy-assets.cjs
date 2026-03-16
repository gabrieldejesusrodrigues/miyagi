const { cpSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');

// TemplateLoader looks at: join(__dirname, '..', 'templates') = dist/templates/
cpSync(join(root, 'src/templates'), join(root, 'dist/templates'), { recursive: true });

// ReportGenerator looks at: join(__dirname, 'templates') = dist/bin/templates/
cpSync(join(root, 'src/reports/templates'), join(root, 'dist/bin/templates'), { recursive: true });

// ReportGenerator looks at: join(__dirname, 'assets', 'styles.css') = dist/bin/assets/
cpSync(join(root, 'src/reports/assets'), join(root, 'dist/bin/assets'), { recursive: true });

// Coach/Judge builtin agents: join(__dirname, '..', 'builtin-agents') = dist/builtin-agents/
cpSync(join(root, 'src/builtin-agents'), join(root, 'dist/builtin-agents'), { recursive: true });

console.log('Static assets copied to dist/');
