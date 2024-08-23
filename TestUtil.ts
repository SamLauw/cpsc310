import * as fs from "fs-extra";
const filePath = "./test/resources/archives/";
const persistDir = "./data";

function getContentFromArchives(name: string): string {
	return fs.readFileSync(`${filePath}${name}`).toString("base64");
}

function getRawContentFromArchives(name: string): Buffer {
	return fs.readFileSync(`${filePath}${name}`);
}

function clearDisk() {
	fs.removeSync(persistDir);
}

export {getContentFromArchives, getRawContentFromArchives, clearDisk, persistDir};
