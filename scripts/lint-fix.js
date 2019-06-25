const runAll = require('npm-run-all');

runAll(
  ["lint-fix:*"],
  {
    parallel: true,
    printLabel: true,
    stdout: process.stdout
  })
  .catch(() => {
    console.log('\x1b[31m%s\x1b[0m', `There was errors when running the lint-fix task.`);
  });
