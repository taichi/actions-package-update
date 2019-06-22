import configure from "@src/config";
import test, { ExecutionContext } from "ava";

test("config#repo", async (t: ExecutionContext) => {
  process.env.GITHUB_WORKSPACE = "./";
  const config = await configure();
  t.truthy(config.get("token"));
  const repo = config.get("git").repository;
  t.is(repo.owner, "taichi");
  t.is(repo.name, "actions-package-update");
});

test("config#validate#token", async (t: ExecutionContext) => {
  process.env.GITHUB_TOKEN = "";
  process.env.AUTHOR_NAME = "taichi";
  process.env.AUTHOR_EMAIL = "ryushi@gmail.com";
  const config = await configure();
  t.throws(() => config.validate({ allowed: "strict" }));
});

test("config#validate#name", async (t: ExecutionContext) => {
  process.env.GITHUB_TOKEN = "aaaaa";
  process.env.AUTHOR_NAME = "";
  process.env.AUTHOR_EMAIL = "ryushi@gmail.com";
  const config = await configure();
  t.throws(() => config.validate({ allowed: "strict" }));
});

test("config#validate#email", async (t: ExecutionContext) => {
  process.env.GITHUB_TOKEN = "aaaaa";
  process.env.AUTHOR_NAME = "taichi";
  process.env.AUTHOR_EMAIL = "";
  const config = await configure();
  t.throws(() => config.validate({ allowed: "strict" }));
});
