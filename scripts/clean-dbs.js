#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targets = [
  'order-service/data',
  'notification-service/data',
  'restaurant-service/data',
  'delivery-service/data'
];

function removeDbFiles(dir) {
  const absDir = path.join(__dirname, '..', dir);
  if (!fs.existsSync(absDir)) return;

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  entries
    .filter((e) => e.isFile() && e.name.endsWith('.db'))
    .forEach((file) => {
      const filePath = path.join(absDir, file.name);
      fs.rmSync(filePath, { force: true });
      console.log(`Removed ${path.relative(process.cwd(), filePath)}`);
    });
}

targets.forEach(removeDbFiles);
console.log('Database cleanup complete.');
