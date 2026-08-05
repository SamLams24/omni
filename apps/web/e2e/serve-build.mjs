import { serve } from "@hono/node-server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const serverDirectory = path.resolve("build/server");
const buildDirectories = (await readdir(serverDirectory, {
	withFileTypes: true,
}))
	.filter((entry) => entry.isDirectory())
	.map((entry) => path.join(serverDirectory, entry.name, "index.js"));

if (buildDirectories.length !== 1) {
	throw new Error(
		`Expected one server build entry, found ${buildDirectories.length}`,
	);
}

const serverBuild = await import(pathToFileURL(buildDirectories[0]).href);
if (typeof serverBuild.default !== "function") {
	throw new TypeError("The Omni server build must export a fetch handler");
}

const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const hostname = process.env.HOST ?? "127.0.0.1";

serve(
	{
		fetch: serverBuild.default,
		hostname,
		port,
	},
	() => {
		console.log(`Omni E2E server listening on http://${hostname}:${port}`);
	},
);
