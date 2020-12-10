import { Octokit } from "@octokit/rest";
import rmd from "@pnpm/read-modules-dir";
import execa, { Options as ExecaOptions } from "execa";
import giturl from "git-url-parse";
import glob from "glob";
import moment from "moment";
import path from "path";
import hash from "sha.js";
import { promisify } from "util";
import packageJson from "../package.json";
import { PackageJsonByName, toMarkdown, toTextTable } from "./body";
import { Config } from "./config";
import Git, { GitFileStatus } from "./git";
import { readFile, readJson } from "./promisify";

type ObjectEntry<T extends Record<string, unknown>> = [string, T[keyof T]];

const mapObjectValues = <TInitial, TTransformed>(
  obj: Record<string, TInitial>,
  callbackFn: (key: string, value: TInitial) => TTransformed
): Record<string, TTransformed> =>
  Object.fromEntries(
    Object.entries(
      obj
    ).map(([key, value]: ObjectEntry<Record<string, TInitial>>) => [
      key,
      callbackFn(key, value)
    ])
  );

type PackageDiff = {
  directoryName: string;
  oldone: PackageJsonByName;
  newone: PackageJsonByName;
};

type PackageJsonByNameByDirectoryName = Record<string, PackageJsonByName>;
type PackageDiffByDirectory = Record<string, PackageDiff>;

export default class Processor {
  private readonly config: Config;
  private readonly git: Git;
  constructor(config: Config) {
    this.config = config;
    this.git = new Git(config);
  }

  public async run(): Promise<string> {
    const now = moment().format("YYYYMMDDhhmm");
    this.config.logger.info("Start process.");

    const { found, newBranch } = await this.makeBranch(now);
    if (found) {
      return `Found existing branch ${found}`;
    }

    const packageDiffs = await this.upgrade();

    const matrix = await this.commit();
    await this.git.checkout("-");
    const project = await readJson(
      path.join(this.config.get("workingdir"), "package.json")
    );

    if (0 < matrix.length) {
      if (this.config.get("execute")) {
        await this.pullRequest(newBranch, project, packageDiffs, now);
      } else {
        this.config.logger.info(
          "git push is skipped. Because EXECUTE environment variable is not true"
        );
        this.config.logger.info(
          [
            "",
            ...(await Promise.all(
              Object.entries(packageDiffs).map(
                async (
                  [
                    directoryName,
                    packageDiff
                  ]: ObjectEntry<PackageDiffByDirectory>,
                  index: number
                ) =>
                  `${index === 0 ? "" : directoryName}\n${toTextTable(
                    await readJson(path.join(directoryName, "package.json")),
                    packageDiff.oldone,
                    packageDiff.newone
                  )} `
              )
            ))
          ].join("\n")
        );
      }
    } else {
      this.config.logger.info("Did not find outdated dependencies.");
    }

    if (!this.config.get("keep")) {
      this.config.logger.info(
        "Delete working branch because KEEP environment variable is not true"
      );
      await this.git.deleteBranch(newBranch);
    }

    return "All done!!";
  }

  protected async makeBranch(now: string) {
    this.config.logger.debug("START makeBranch");
    const json = await this.getFile("package.json");
    if (!json) {
      throw new Error("package.json not found");
    }

    const hex = new hash.sha1().update(json.toString(), "utf8").digest("hex");
    const newBranch = `${this.config.get("git").prefix}${now}/${hex}`;

    await this.git.fetch("origin");
    this.config.logger.debug("listBranches");
    const branches = await this.git.listBranches();
    this.config.logger.trace("%o", branches);
    const found = branches.find((name: string) => name.endsWith(hex));
    this.config.logger.debug("found branch is %s", found);
    if (!found) {
      await this.git.checkoutWith(newBranch);
    }
    this.config.logger.debug("END   makeBranch");
    return { found, newBranch };
  }

  protected async upgrade(): Promise<PackageDiffByDirectory> {
    this.config.logger.debug("START upgrade");
    await this.install();
    const oldones = await this.collectPackage();
    const arg = process.argv.slice(2);
    const cmd = this.config.get("update");
    const ncu = await this.runInWorkingDir(cmd, arg);
    if (ncu.failed) {
      this.config.logger.debug("FAILED upgrade");
      throw new Error(ncu.stderr);
    }
    await this.install();
    const newones = await this.collectPackage();
    this.config.logger.debug("END   upgrade");

    if (oldones.length !== newones.length) {
      throw new Error("received more package.jsons than previous");
    }

    return mapObjectValues(
      oldones,
      (directoryName: string, oldone: PackageJsonByName) => ({
        directoryName,
        oldone,
        newone: newones[directoryName]
      })
    );
  }

  protected async commit() {
    this.config.logger.debug("START commit");
    const matrix = await this.git.status();
    if (0 < matrix.length) {
      this.config.logger.debug("files are changed");
      this.config.logger.trace("changed files are %o", matrix);
      const commitFiles = this.config.get("git").files.split(" ");
      const filesToAdd = matrix
        .filter((f: GitFileStatus) => commitFiles.includes(f.path))
        .map((f: GitFileStatus) => f.path);
      if (filesToAdd.length > 0) {
        this.config.logger.debug("files to add are %o", filesToAdd);
        await this.git.add(filesToAdd);
      } else {
        await this.git.addAll();
      }
      await this.git.setup(
        this.config.get("git").username,
        this.config.get("git").useremail
      );
      await this.git.commit(this.config.get("git").message);
    }
    this.config.logger.debug("END   commit");
    return matrix;
  }

  protected async newGitHub(config: Config, repo: giturl.GitUrl) {
    return new Octokit({
      auth: `token ${config.get("token")}`,
      userAgent: `${packageJson.name}/${packageJson.version}`,
      // for GHE
      baseUrl:
        repo.resource !== "github.com"
          ? `https://${repo.resource}/api/v3`
          : undefined
    });
  }

  protected async pullRequest(
    newBranch: string,
    project: PackageJson,
    packageDiffs: PackageDiffByDirectory,
    now: string
  ) {
    this.config.logger.debug("START pullRequest");

    await this.git.push("origin", newBranch);

    this.config.logger.trace(packageDiffs);

    const body = (
      await Promise.all(
        Object.entries(packageDiffs).map(
          async (
            [directoryName, packageDiff]: ObjectEntry<PackageDiffByDirectory>,
            index: number
          ) =>
            `${
              Object.entries(packageDiffs).length > 1
                ? index === 0
                  ? "## root"
                  : `## ${directoryName}`
                : "## Updating Dependencies"
            }\n${toMarkdown(
              await readJson(path.join(directoryName, "package.json")),
              packageDiff.oldone,
              packageDiff.newone
            )}`
        )
      )
    ).join("\n");
    const url = await this.git.remoteurl("origin");
    const origin = giturl(url);
    const github = await this.newGitHub(this.config, origin);
    const repo = await github.repos.get({
      owner: origin.owner,
      repo: origin.name
    });
    const pr = {
      owner: origin.owner,
      repo: origin.name,
      base: repo.data.default_branch,
      head: newBranch,
      title: this.config.get("title"),
      body: `${body}\n\nPowered by [${packageJson.name}](${packageJson.homepage})`
    };
    this.config.logger.debug("Pull Request create");
    this.config.logger.trace(pr);
    await github.pulls.create(pr);
    this.config.logger.debug("END   pullRequest");
  }

  protected async install() {
    this.config.logger.debug("START install");
    const yl = await this.getFile("yarn.lock");
    if (yl) {
      this.config.logger.debug("use yarn");
      await this.runInWorkingDir("yarn", "install");
      return;
    }

    this.config.logger.debug("use npm");
    await this.runInWorkingDir("npm", "install");

    this.config.logger.debug("END   install");
  }

  protected async getFile(name: string) {
    const n = path.join(this.config.get("workingdir"), name);
    this.config.logger.debug("getFile %s", n);
    return readFile(n, { encoding: "utf8" }).catch(() => undefined);
  }

  protected async runInWorkingDir(
    command: string,
    args?: string[] | string,
    opts?: ExecaOptions
  ) {
    const a = typeof args === "string" ? [args] : args;
    this.config.logger.debug("runInWorkingDir %s %o", command, a);
    const kids = execa(command, a, {
      cwd: this.config.get("workingdir"),
      ...opts
    });
    if (this.config.logger.levelVal < 30) {
      if (kids.stdout) {
        kids.stdout.pipe(process.stdout);
      }
      if (kids.stderr) {
        kids.stderr.pipe(process.stderr);
      }
    }
    return kids;
  }

  protected async collectPackage(): Promise<PackageJsonByNameByDirectoryName> {
    const rootWorkingdir = this.config.get("workingdir");

    const rootJson: PackageJson & { workspaces?: string[] } = await readJson(
      path.join(rootWorkingdir, "./package.json")
    );

    const workingdirs = rootJson.workspaces
      ? [
          rootWorkingdir,
          ...(await Promise.all(
            rootJson.workspaces.map((workspace: string) =>
              promisify(glob)(path.join(rootWorkingdir, workspace))
            )
          ))
        ].flat()
      : [rootWorkingdir];

    return Object.fromEntries(
      await Promise.all(
        workingdirs.map(
          async (
            workingdir: string
          ): Promise<ObjectEntry<PackageJsonByNameByDirectoryName>> => {
            this.config.logger.debug("START collectPackage");
            const shadows = this.config.get("shadows");
            const root = await readJson(
              path.join(workingdir, "./package.json")
            );
            this.config.logger.trace(root);
            const contains = (name: string, d?: Dependencies) => d && d[name];
            const withShadows = ([name, _]: [string, PackageJson]) => {
              return (
                contains(name, root.dependencies) ||
                contains(name, root.devDependencies) ||
                contains(name, root.optionalDependencies)
              );
            };
            const filter = shadows ? () => true : withShadows;

            const rootModules = path.join(rootWorkingdir, "node_modules");
            const workspaceModules =
              rootWorkingdir !== workingdir
                ? path.join(workingdir, "node_modules")
                : undefined;

            const dirs = await rmd(rootModules);
            const workspaceDirs = workspaceModules
              ? await rmd(workspaceModules)
              : undefined;

            this.config.logger.trace("module directories are %o", dirs);
            if (dirs) {
              const pkgs = await Promise.all(
                dirs.map((dir: string) =>
                  readJson(`${rootModules}/${dir}/package.json`)
                )
              );
              const workspacePkgs = workspaceDirs
                ? await Promise.all(
                    workspaceDirs.map((dir: string) =>
                      readJson(`${workspaceModules}/${dir}/package.json`)
                    )
                  )
                : [];

              this.config.logger.trace("packages %o", pkgs);
              const nvs = [...workspacePkgs, ...pkgs]
                .map<[string, PackageJson]>((p: PackageJson) => [p.name, p])
                .filter(filter);
              this.config.logger.debug("END   collectPackage");
              return [workingdir, new Map(nvs)];
            }
            this.config.logger.debug("END   collectPackage");
            return [workingdir, new Map()];
          }
        )
      )
    );
  }
}
