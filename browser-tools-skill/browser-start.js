#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
	console.log("Usage: browser-start.js [--profile]");
	console.log("\nOptions:");
	console.log("  --profile  Copy your default Chrome profile (cookies, logins)");
	console.log("\nExamples:");
	console.log("  browser-start.js            # Start with fresh profile");
	console.log("  browser-start.js --profile  # Start with your Chrome profile");
	process.exit(1);
}

// Kill existing Chrome
// read pid from previous run and kill
try {
	const pid = execSync("cat ~/.cache/scraping/chrome.pid", {
		encoding: "utf-8",
	}).trim();
	execSync(`kill ${pid}`, { stdio: "ignore" });
} catch {}

// Wait a bit for processes to fully die
await new Promise((r) => setTimeout(r, 1000));

// Setup profile directory
execSync("mkdir -p ~/.cache/scraping", { stdio: "ignore" });

if (useProfile) {
	// Sync profile with rsync (much faster on subsequent runs)
	execSync(
		`rsync -a --delete "${process.env["HOME"]}/Library/Application Support/Google/Chrome/" ~/.cache/scraping/`,
		{ stdio: "pipe" },
	);
}

// Start Chrome in background (detached so Node can exit)
const chromeProcess = spawn(
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	["--remote-debugging-port=9222", `--user-data-dir=${process.env["HOME"]}/.cache/scraping`, '--window-name="Chrome Debugging"'],
	{ detached: true, stdio: "ignore" },
);

execSync(`echo ${chromeProcess.pid} > ~/.cache/scraping/chrome.pid`);

chromeProcess.unref();

// Wait for Chrome to be ready by attempting to connect
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Chrome");
	process.exit(1);
}

console.log(`✓ Chrome started on :9222${useProfile ? " with your profile" : ""}`);
