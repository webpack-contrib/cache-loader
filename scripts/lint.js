const runAll = require('npm-run-all');

runAll(
  ["lint:*"],
  {
    parallel: true,
    printLabel: true,
    stdout: process.stdout
  })
  .catch(() => {
    console.log('\x1b[31m%s\x1b[0m', `There was errors when running the lint task. Please execute 'npm run lint-fix'.`);
  });
