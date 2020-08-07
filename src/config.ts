import convict from "convict";
import validator from "convict-format-with-validator";
import pino from "pino";

convict.addFormats(validator);

const defaultPrefix = "package-update/";
const defaultMessage = "update dependencies";

const rawConfig = convict({
  workingdir: {
    default: "./",
    env: "WORKING_DIR"
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
      format: "email"
    },
    prefix: {
      default: defaultPrefix,
      doc: `specify working branch prefix. default prefix is ${defaultPrefix}`,
      env: "BRANCH_PREFIX"
    },
    message: {
      default: defaultMessage,
      doc: `specify the commit message. default message is ${defaultMessage}`,
      env: "COMMIT_MESSAGE"
    },
    files: {
      default: "",
      doc:
        "a space separated list of file that will be added to the commit. Leave empty to add all changes.",
      env: "COMMIT_FILES"
    }
  },
  title: {
    default: defaultMessage,
    doc: `specify the commit message. default message is ${defaultMessage}`,
    env: "PULL_REQUEST_TITLE"
  },
  update: {
    default: "ncu",
    doc: "specify the command for update. default command is ncu.",
    env: "UPDATE_COMMAND"
  },
  shadows: {
    default: false,
    doc: "if you specify this option, shows shadow dependencies changes.",
    env: "WITH_SHADOWS"
  },
  execute: {
    default: false,
    doc:
      "if you don't specify this option, allows you to test this application.",
    env: "EXECUTE",
    format: Boolean
  },
  keep: {
    default: false,
    doc: "if you specify this option, keep working branch after all.",
    env: "KEEP",
    format: Boolean
  },
  log: {
    level: {
      default: "info",
      env: "LOG_LEVEL"
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
