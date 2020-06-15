import execa from "execa";
import { Config } from "./config";

export type GitFileStatus = { x: string; y: string; path: string };
export default class Git {
  private readonly conf: Config;
  constructor(config: Config) {
    this.conf = config;
  }

  public async run(subcmd: string[] = []) {
    const msg = `git ${subcmd.join(" ")}`;
    this.conf.logger.debug(`BEGIN ${msg}`);
    return execa("git", subcmd, { cwd: this.conf.get("workingdir") }).then(
      (value: execa.ExecaReturnValue) => {
        this.conf.logger.debug(`END   ${msg}`);
        if (value.failed) {
          throw new Error(`${msg} failed`);
        }
        return value;
      }
    );
  }

  public async setup(name: string, email: string) {
    return this.config("user.name", name).then(() =>
      this.config("user.email", email)
    );
  }

  public async config(key: string, value: string) {
    return this.run(["config", key, value]);
  }

  public async fetch(remote: string) {
    return this.run(["fetch", "--prune", remote]);
  }

  public async listBranches() {
    const result = await this.run(["branch", "-a"]);
    return result.stdout.split(/[\r]?\n/);
  }

  public async currentBranch() {
    const result = await this.run(["rev-parse", "--abbrev-ref", "HEAD"]);
    return result.stdout.trim();
  }

  public async checkout(branch: string) {
    return this.run(["checkout", branch]);
  }

  public async checkoutWith(newBranch: string) {
    return this.run(["checkout", "-b", newBranch]);
  }

  public async status(): Promise<GitFileStatus[]> {
    const result = await this.run(["status", "--porcelain=v1"]);
    return result.stdout
      .split(/[\r]?\n/)
      .filter((s: string) => s)
      .map((s: string) => {
        const x = s[0];
        const y = s[1];
        const path = s.substring(3);
        return { x, y, path };
      });
  }

  public async addAll() {
    return this.run(["add", "--all"]);
  }

  public async add(files: string[]) {
    return this.run(["add", ...files]);
  }

  public async commit(message: string) {
    return this.run(["commit", "-m", message]);
  }

  public async push(remote: string, branch: string) {
    return this.run(["push", remote, branch]);
  }

  public async remoteurl(remote: string) {
    const result = await this.run(["remote", "get-url", "--push", remote]);
    return result.stdout.trim();
  }

  public async deleteBranch(branch: string) {
    return this.run(["branch", "-D", branch]);
  }
}
