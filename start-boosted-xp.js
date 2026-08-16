'use strict';

// Sets the server's XP rate multiplier (engine/data/config/world.json -> node.xpRate)
// and then starts the server. Run `node start.js` first if you haven't set up the
// engine/content yet.
//
// Usage:
//   node start-boosted-xp.js        # defaults to 50x
//   node start-boosted-xp.js 100    # custom multiplier

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const xpRate = process.argv[2] ? parseInt(process.argv[2], 10) : 50;

if (!Number.isInteger(xpRate) || xpRate < 1) {
    console.error(`Invalid xp rate: ${process.argv[2]}`);
    process.exit(1);
}

if (!fs.existsSync('engine')) {
    console.error('engine/ not found. Run `node start.js` first to set up the server.');
    process.exit(1);
}

const configDir = path.join('engine', 'data', 'config');
const configPath = path.join(configDir, 'world.json');

fs.mkdirSync(configDir, { recursive: true });

let config = {};
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

config.node = config.node || {};
config.node.xpRate = xpRate;

fs.writeFileSync(configPath, JSON.stringify(config, null, 4) + '\n');

console.log(`XP rate set to ${xpRate}x. Starting server...`);

child_process.execSync('npm start', {
    stdio: 'inherit',
    cwd: 'engine'
});
