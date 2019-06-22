import Octokit from "@octokit/rest";
import rmd from "@pnpm/read-modules-dir";
import execa, { Options as ExecaOptions } from "execa";
import * as fs from "fs";
import * as git from "isomorphic-git";
import moment from "moment";
import path from "path";
import hash from "sha.js";
import packageJson from "../package.json";
import { toMarkdown, toTextTable } from "./body";
import { Config } from "./config";
import { readFile, readJson } from "./promisify";


function newGitHub(config: Config) {
  const repo = config.get("git").repository;
  const ghopt: Octokit.Options = {
    auth: `token ${config.get("token")}`,
    userAgent: `${packageJson.name}/${packageJson.version}`
  };
  if (repo.resource !== "github.com") {
    // for GHE
    ghopt.baseUrl = `https://${repo.resource}/api/v3`;
  }
  return new Octokit(ghopt);
}

export default class Processor {
  private readonly config: Config;
  private readonly github: Octokit;
  private readonly options: { fs: typeof fs, dir: string };
  constructor(config: Config) {
    this.config = config;
    this.github = newGitHub(config);
    this.options = { fs, dir: this.config.get("workspace") };
  }

  public async run(): Promise<string> {
    const now = moment().format("YYYYMMDDhhmm");

    const { found, newBranch } = await this.makeBranch(now);
    if (found) {
      return `Found existing branch ${found.name} ${found.commit}`;
    }

    const { oldone, newone } = await this.upgrade();

    const matrix = await this.commit();
    if (matrix.length < 1) {
      return "Did not find outdated dependencies.";
    }

    if (!this.config.get("execute")) {
      this.config.logger.info("git push is skipped. Because EXECUTE=true is not specified.");
      return toTextTable(oldone, newone);
    }

    await this.pullRequest(newBranch, oldone, newone, now);

    return "All done!!";
  }

  protected async makeBranch(now: string) {
    this.config.logger.info("START makeBranch");
    const json = await this.getFile("package.json");
    const hex = new hash.sha1().update(json, "utf8").digest("hex");
    const newBranch = `${this.config.get("git").prefix}${now}/${hex}`;
    this.config.logger.info("listBranches");
    const branches = await this.github.repos.listBranches(this.config.repo());
    const found = branches.data.find((v: Octokit.ReposListBranchesResponseItem) => v.name.endsWith(hex));
    this.config.logger.info("found branch is %s", found);
    if (!found) {
      await git.branch({ ...this.options, ref: newBranch, checkout: true });
    }
    this.config.logger.info("END   makeBranch");
    return { found, newBranch };
  }

  protected async upgrade() {
    this.config.logger.info("START upgrade");
    await this.install();
    const oldone = await this.collectPackage();
    const arg = process.argv.slice(1);
    const cmd = this.config.get("update");
    const ncu = await this.runInWorkspace(cmd, arg);
    if (ncu.failed) {
      this.config.logger.info("FAILED upgrade");
      throw new Error(ncu.stderr);
    }
    await this.install();
    const newone = await this.collectPackage();
    this.config.logger.info("END   upgrade");
    return { oldone, newone };
  }

  protected async commit() {
    this.config.logger.info("START commit");
    const matrix = await git.statusMatrix(this.options);
    if (0 < matrix.length) {
      this.config.logger.info("files are changed");
      this.config.logger.debug("changed files are %o", matrix);
      await Promise.all(matrix.map(async (m: [string, number, number, number]) => {
        const ad = { ...this.options, filepath: m[0] };
        this.config.logger.debug(ad);
        return git.add(ad);
      }));
      const cmt = {
        ...this.options,
        message: this.config.get("git").message,
        author: {
          name: this.config.get("git").username,
          email: this.config.get("git").useremail
        }
      };
      this.config.logger.debug(cmt);
      await git.commit(cmt);
    }
    this.config.logger.info("END   commit");
    return matrix;
  }

  protected async pullRequest(
    newBranch: string,
    oldone: Map<string, PackageJson>, newone: Map<string, PackageJson>,
    now: string) {
    this.config.logger.info("START pullRequest");
    await git.push({
      ...this.options,
      token: this.config.get("token"),
      remote: "origin",
      ref: newBranch
    });
    const body = toMarkdown(oldone, newone);
    const pr = {
      ...this.config.repo(),
      base: this.config.get("git").target,
      head: newBranch,
      title: `update dependencies at ${now}`,
      body
    };
    this.config.logger.info("Pull Request create");
    this.config.logger.debug(pr);
    await this.github.pulls.create(pr);
    this.config.logger.info("END   pullRequest");
  }

  protected async install() {
    this.config.logger.info("START install");
    const pl = this.getFile("package-lock.json");
    if (pl) {
      this.config.logger.info("use npm");
      await this.runInWorkspace("npm", "install");
    }

    const yl = this.getFile("yarn.lock");
    if (yl) {
      this.config.logger.info("use yarn");
      await this.runInWorkspace("yarn", "install");
    }
    this.config.logger.info("END   install");
  }

  protected async getFile(name: string, encoding: string = "utf8") {
    const n = path.join(this.config.get("workspace"), name);
    this.config.logger.info("getFile %s", n);
    return readFile(n, { encoding });
  }

  protected async runInWorkspace(command: string, args?: string[] | string, opts?: ExecaOptions) {
    const a = typeof args === "string" ? [args] : args;
    this.config.logger.info("runInWorkspace %o", a);
    return execa(command, a, { cwd: this.config.get("workspace"), ...opts });
  }

  protected async collectPackage(): Promise<Map<string, PackageJson>> {
    this.config.logger.info("START collectPackage");
    const workspace = this.config.get("workspace");
    const shadows = this.config.get("shadows");
    const root = await readJson(`${workspace}/package.json`);
    this.config.logger.debug(root);
    const contains = (name: string, d?: Dependencies) => d && d[name];
    const filter = shadows ?
      () => true :
      ([name, _]: [string, PackageJson]) => {
        return contains(name, root.dependencies)
          || contains(name, root.devDependencies)
          || contains(name, root.optionalDependencies);
      };

    const modules = path.join(workspace, "node_modules");
    const dirs = await rmd(modules);
    this.config.logger.debug("module directories are %o", dirs);
    if (dirs) {
      const pkgs = await Promise.all(dirs.map((dir: string) => readJson(`${dir}/package.json`)));
      this.config.logger.debug("packages %o", pkgs);
      const nvs = pkgs.map<[string, PackageJson]>((p: PackageJson) => [p.name, p]).filter(filter);
      this.config.logger.info("END   collectPackage");
      return new Map(nvs);
    }
    this.config.logger.info("END   collectPackage");
    return new Map();
  }
}
