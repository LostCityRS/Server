'use strict';

const child_process = require('child_process');
const fs = require('fs');

const { ExitPromptError } = require('@inquirer/core');
const { select } = require('@inquirer/prompts');

// if you're forking this feel free to change these :) it does make some assumptions elsewhere (branch names)
const repoOrg = 'https://github.com/LostCityRS';
const engineRepo = 'Engine-TS';
const contentRepo = 'Content';
const webRepo = 'Client-TS';
const javaRepo = 'Client-Java';

function cloneRepo(repo, dir, branch) {
    child_process.execSync(`git clone ${repoOrg}/${repo} --single-branch -b ${branch} ${dir}`, {
        stdio: 'inherit'
    });
}

function updateRepo(cwd) {
    child_process.execSync('git pull', {
        stdio: 'inherit',
        cwd
    });
}

function runOnOs(exec, cwd) {
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');

    child_process.execSync(`${start} ${exec}`, {
        stdio: 'inherit',
        cwd
    });
}

let config = {
    rev: 'unset'
};

const revInfo = {
    '225': {
        description: 'May 18, 2004',
        webclient: true
    },
    '244': {
        description: 'June 28, 2004',
        webclient: true
    },
    '245.2': {
        description: 'July 13, 2004 (there were 3 "245" builds!)',
        webclient: true
    },
    '254': {
        description: 'September 7, 2004',
        webclient: true
    },
    '274': {
        description: 'November 23, 2004',
        webclient: true
    },
    '289': {
        description: 'January 17, 2005',
        wip: true,
        webclient: true
    },
    '377-wip': {
        description: 'May 5, 2006',
        wip: true,
        clientBranch: '377'
    }
};

let running = true;
async function main() {
    if (process.env.SERVER_REV) {
        setRev(process.env.SERVER_REV);
    } else if (!fs.existsSync('server.json')) {
        await promptConfig();
    }

    config = JSON.parse(fs.readFileSync('server.json', 'utf8'));

    if (!fs.existsSync('engine')) {
        cloneRepo(engineRepo, 'engine', config.rev);
    }

    linkSaveData();

    if (!fs.existsSync('content')) {
        cloneRepo(contentRepo, 'content', config.rev);
    }

    if (revInfo[config.rev]?.webclient && !fs.existsSync('webclient')) {
        cloneRepo(webRepo, 'webclient', config.rev);
    }

    if (!fs.existsSync('javaclient')) {
        cloneRepo(javaRepo, 'javaclient', revInfo[config.rev]?.clientBranch ?? config.rev);
    }

    if (!fs.existsSync('engine/.env') && !fs.existsSync('engine/data/config/world.json')) {
        child_process.spawnSync('npm install', {
            shell: true,
            stdio: 'inherit',
            cwd: 'engine'
        });

        child_process.spawnSync('npm run setup', {
            shell: true,
            stdio: 'inherit',
            cwd: 'engine'
        });
    }

    if (process.env.SERVER_AUTOSTART) {
        running = false;
        startServer();
        return;
    }

    const choice = await select({
        message: 'What would you like to do?',
        choices: [{
            name: 'Start Server',
            description: 'Starts the server normally',
            value: 'start'
        }, {
            name: 'Update Source',
            description: 'Pull the latest commits for all subprojects',
            value: 'update'
        },
        revInfo[config.rev]?.webclient ? {
            name: 'Run Web Client',
            description: 'Opens your browser to play using the modern web client (TypeScript)',
            value: 'web'
        } : {
            name: 'Run Web Client (unavailable)',
            description: 'Not available in this version.',
            value: ''
        },
        {
            name: 'Run Java Client',
            description: 'Opens the legacy Java applet to play using the original client',
            value: 'java'
        }, {
            name: 'Advanced Options',
            description: 'View more options',
            value: 'advanced'
        }, {
            name: 'Quit',
            description: '',
            value: 'quit'
        }]
    }, { clearPromptOnDone: true });

    if (choice === 'start') {
        startServer();
    } else if (choice === 'update') {
        updateRepo('engine');
        updateRepo('content');
        updateRepo('webclient');
        updateRepo('javaclient');
    } else if (choice === 'web') {
        if (!revInfo[config.rev]?.webclient) {
            console.log('This version does not have a webclient available (yet?), sorry.');
        } else if (process.platform === 'win32' || process.platform === 'darwin') {
            runOnOs('http://localhost/rs2.cgi');
        } else {
            runOnOs('http://localhost:8888/rs2.cgi');
        }
    } else if (choice === 'java') {
        const command = process.platform === 'win32' ? 'gradlew' : './gradlew';
        if (config.rev === '225') {
            child_process.execSync(`${command} run --args="10 0 highmem members"`, {
                stdio: 'inherit',
                cwd: 'javaclient'
            });
        } else {
            child_process.execSync(`${command} run --args="10 0 highmem members 32"`, {
                stdio: 'inherit',
                cwd: 'javaclient'
            });
        }
    } else if (choice === 'advanced') {
        await promptAdvanced();
    } else if (choice === 'quit') {
        running = false;
    }
}

function startServer() {
    child_process.execSync('npm start', {
        stdio: 'inherit',
        cwd: 'engine'
    });
}

// lets docker compose (or anyone else) pick the version without prompting for it
function setRev(rev) {
    if (!revInfo[rev]) {
        console.log(`Unknown version ${rev}, pick one of: ${Object.keys(revInfo).join(', ')}`);
        process.exit(1);
    }

    if (fs.existsSync('server.json')) {
        config = JSON.parse(fs.readFileSync('server.json', 'utf8'));

        if (config.rev === rev) {
            return;
        }

        cleanWorkingFolder(); // changing versions needs fresh checkouts
    }

    config.rev = rev;

    fs.writeFileSync('server.json', JSON.stringify(config, null, 2));
}

const saveLinks = [
    ['engine/data/players', '../../save/players', 'save/players'],
    ['engine/db.sqlite', '../save/db.sqlite', 'save/db.sqlite']
];

// keeps accounts and characters in save/, so they outlive a version change wiping the checkouts.
// anything the engine already wrote into the checkout itself is moved out first - installs from
// before save/ existed have real files there, and cleanWorkingFolder would take them along
function linkSaveData() {
    if (!fs.existsSync('engine')) {
        return;
    }

    fs.mkdirSync('save/players', { recursive: true });

    for (const [path, target, saved] of saveLinks) {
        const stat = fs.lstatSync(path, { throwIfNoEntry: false });

        if (stat && stat.isSymbolicLink()) {
            continue; // already linked by an earlier run
        }

        if (stat) {
            moveIntoSave(path, saved, stat);
        }

        fs.symlinkSync(target, path);
    }
}

// save/ is the copy we keep, so a name that is already there wins and the checkout's
// version is set aside as .old rather than thrown away
function moveIntoSave(path, saved, stat) {
    if (!stat.isDirectory()) {
        fs.renameSync(path, fs.existsSync(saved) ? `${saved}.old` : saved);
        return;
    }

    for (const entry of fs.readdirSync(path)) {
        const dest = `${saved}/${entry}`;
        fs.renameSync(`${path}/${entry}`, fs.existsSync(dest) ? `${dest}.old` : dest);
    }

    fs.rmSync(path, { recursive: true, force: true });
}

// only removes the checkouts - the save data is moved into save/ first and survives as a link
function cleanWorkingFolder() {
    linkSaveData();

    fs.rmSync('engine', { recursive: true, force: true });
    fs.rmSync('content', { recursive: true, force: true });
    fs.rmSync('webclient', { recursive: true, force: true });
    fs.rmSync('javaclient', { recursive: true, force: true });
}

async function promptConfig() {
    const orderedRevs = Object.entries(revInfo);
    orderedRevs.sort((a, b) => parseInt(a[0]) - parseInt(b[0])); // descending revs
    orderedRevs.sort((a, b) => a[1].wip ? 1 : -1); // wip last

    let choices = [];
    for (const [rev, info] of orderedRevs) {
        choices.push({
            name: info.wip ? `${rev} (DEVELOPERS ONLY)` : rev,
            value: rev,
            description: info.description
        });
    }

    const rev = await select({
        message: 'What version are you interested in?',
        choices
    }, { clearPromptOnDone: true });

    config.rev = rev;

    fs.writeFileSync('server.json', JSON.stringify(config, null, 2));
}

async function promptAdvanced() {
    const choice = await select({
        message: 'What would you like to do?',
        choices: [{
            name: 'Start Server (engine dev)',
            description: 'Starts the server and watches for .ts file changes to reload',
            value: 'start-dev'
        }, {
             name: 'Reconfigure Server',
             description: 'Edit the environment config for the server',
             value: 'configure'
        }, {
            name: 'Clean-build Server',
            description: '',
            value: 'clean-build'
        },
        revInfo[config.rev]?.webclient ? {
            name: 'Build Web Client',
            description: '',
            value: 'build-web'
        } : {
            name: 'Build Web Client (unavailable)',
            description: 'Not available in this version.',
            value: ''
        },
        {
            name: 'Build Java Client',
            description: '',
            value: 'build-java'
        }, {
            name: 'Change Version',
            description: 'THIS OPTION WILL DESTROY YOUR WORKING FOLDER AND CREATE A NEW ONE.',
            value: 'change-version'
        }, {
            name: 'Back',
            description: 'Go back',
            value: 'back'
        }]
    }, { clearPromptOnDone: true });

    if (choice === 'start-dev') {
        child_process.execSync('npm run dev', {
            stdio: 'inherit',
            cwd: 'engine'
        });
    } else if (choice === 'configure') {
        child_process.spawnSync('npm run setup', {
            shell: true,
            stdio: 'inherit',
            cwd: 'engine'
        });
    } else if (choice === 'clean-build') {
        child_process.execSync('npm run clean', {
            stdio: 'inherit',
            cwd: 'engine'
        });

        child_process.execSync('npm run build', {
            stdio: 'inherit',
            cwd: 'engine'
        });
    } else if (choice === 'build-web') {
        child_process.execSync('npm run build', {
            stdio: 'inherit',
            cwd: 'webclient'
        });

        fs.copyFileSync('webclient/out/client.js', 'engine/public/client/client.js');
    } else if (choice === 'build-java') {
        const command = process.platform === 'win32' ? 'gradlew' : './gradlew';
        child_process.execSync(`${command} build`, {
            stdio: 'inherit',
            cwd: 'javaclient'
        });
    } else if (choice === 'change-version') {
        await promptConfig();

        cleanWorkingFolder();
    }
}

async function run() {
    try {
        while (running) {
            await main();
        }
    } catch (e) {
        if (e instanceof ExitPromptError) {
            process.exit(0);
        } else if (e instanceof Error) {
            if (e.message.startsWith('Command failed:')) {
                process.exit(0);
            }

            console.log(e.message);
        }
    }
}

run();
