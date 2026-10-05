npm ci --no-audit --no-fund >/dev/null 2>&1
npx vitest run 2>&1 | tail -40
npx tsc -b 2>&1 | tail -20
npx eslint src/modules/domains 2>&1 | tail -20
rm -rf node_modules
