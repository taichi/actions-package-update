import * as fs from "fs";
import _rpj from "read-package-json";
import * as util from "util";

export const readJson = util.promisify(_rpj);
export const readFile = util.promisify(fs.readFile);
