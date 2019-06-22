import convict from "convict";
import pino from "pino";

const defaultPrefix = "package-update/";
const defaultMessage = "update dependencies";

const rawConfig = convict({
  workspace: {
    default: "./",
    env: "GITHUB_WORKSPACE"
  },
  token: {
    default: "",
    doc: "GitHub Access Token.",
    format: (value: string) => {
      if (!value) {
        throw new Error("must be set a GitHub Access Token.");
      }
    },
    env: "GITHUB_TOKEN",
    arg: "token",
    sensitive: true
  },
  git: {
    username: {
      default: "",
      doc: "specify the commit auther name.",
      env: "AUTHOR_NAME",
      format: (value: string) => {
        if (!value) {
          throw new Error("must be set the commit auther name.");
        }
      },
      arg: "username"
    },
    useremail: {
      default: "",
      doc: "specify the commit auther email.",
      env: "AUTHOR_EMAIL",
      format: "email",
      arg: "useremail"
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
  keep: {
    default: false,
    doc: "if you specify this option, keep working branch after all.",
    env: "KEEP",
    format: Boolean,
    arg: "keep"
  },
  log: {
    level: {
      default: "warn",
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
  })
};

export type Config = typeof config;

export default config;
