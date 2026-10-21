#!/usr/bin/env node
/**
 * PostToolUse hook — reminds Bob to update app/roadmap-panel.tsx
 * after any src/ or app/ file write (excluding roadmap-panel.tsx itself).
 */
let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try { input = JSON.parse(raw); } catch { process.exit(0); }

const path = String(input?.tool_input?.path ?? "");

// Only care about source files in src/ or app/
const isSourceFile = /^(src|app)\//.test(path);
const isRoadmap = path.includes("roadmap-panel");

if (isSourceFile && !isRoadmap) {
    process.stdout.write(
        `ROADMAP REMINDER: ${path} was just written/edited. ` +
        `If this implements or advances a P0/P1 roadmap feature, ` +
        `update app/roadmap-panel.tsx — change the matching feature status ` +
        `(planned→done/partial), add a note, and update the relevant Phase items.`
    );
}
