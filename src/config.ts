import convict from "convict";
import * as fs from "fs";
import giturl from "git-url-parse";
import * as git from "isomorphic-git";
import pino from "pino";

convict.addFormat({
  name: "repository",
  coerce: (value: string) => {
    const p = git.listRemotes({
      fs: fs,
      dir: value
    });
    let result;
    Promise.resolve(p)
      .then((remotes: git.RemoteDefinition[]) => {
        const origin = remotes.find((v: git.RemoteDefinition) => v.remote === "origin");
        if (origin) {
          result = giturl(origin.url);
        } else {
          throw new Error("git remote origin doesn't found");
        }
      })
      .catch((err: Error) => {
        throw err;
      });
    return result;
  }
});

const defaultPrefix = "package-update/";
const defaultMessage = "update dependencies";
const rawConfig = convict({
  workspace: {
    default: "./",
    env: "GITHUB_WORKSPACE"
  },
  token: {
    default: "",
    env: "GITHUB_TOKEN",
    arg: "token",
    sensitive: true
  },
  git: {
    username: {
      default: "",
      doc: "specify the commit auther name.",
      env: "AUTHOR_NAME",
      format: String,
      arg: "username"
    },
    useremail: {
      default: "",
      doc: "specify the commit auther email.",
      env: "AUTHOR_EMAIL",
      format: "email",
      arg: "useremail"
    },
    repository: {
      default: giturl("/"),
      format: "repository",
      env: "GITHUB_WORKSPACE",
      arg: "repo"
    },
    prefix: {
      default: defaultPrefix,
      doc: `specify working branch prefix. default prefix is ${defaultPrefix}`,
      env: "BRANCH_PREFIX",
      arg: "prefix"
    },
    message: {
      default: "update dependencies",
      doc: `specify the commit message. default message is ${defaultMessage}`,
      env: "COMMIT_MESSAGE"
    },
    target: {
      default: "refs/heads/master",
      doc: "Pull Requst target Branch",
      env: "BASE_BRANCH"
    }
  },
  update: {
    default: "npm-check-updates",
    env: "UPDATE_COMMAND"
  },
  shadows: {
    default: false,
    doc: "if you specify this option, shows shadow dependencies changes.",
    env: "WITH_SHADOWS",
    arg: "with-shadows"
  },
  execute: {
    default: false,
    doc: "if you don't specify this option, allows you to test this application.",
    env: "EXECUTE",
    format: Boolean,
    arg: "execute"
  },
  log: {
    level: {
      default: "warn",
      doc: "",
      env: "LOG_LEVEL",
      arg: "log-level"
    }
  }
});

const config = {
  ...rawConfig,
  logger: pino({
    level: rawConfig.get("log").level,
    prettyPrint: true
  }),
  repo: () => {
    const url = rawConfig.get("git").repository;
    const owner = url.owner;
    const repo = url.name;
    return { owner, repo };
  }
};

export type Config = typeof config;

export default config;
