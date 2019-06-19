import convict from "convict";
import dotenv from "dotenv";

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH
});

const config = convict({
  env: {
    doc: "The application environment.",
    format: ["production", "development", "test"],
    default: "development",
    env: "NODE_ENV"
  },
  retry: {
    limit: {
      default: 10,
      env: "RETRY_LIMIT",
      format: Number
    },
    wait: {
      default: 50,
      env: "RETRY_WAIT",
      format: Number
    }
  }
});

config.validate({ strict: true });

export default config;
