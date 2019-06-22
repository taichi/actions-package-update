import test, { ExecutionContext } from "ava";

test("config#validate#token", async (t: ExecutionContext) => {
  process.env.GITHUB_TOKEN = "";
  process.env.AUTHOR_NAME = "taichi";
  process.env.AUTHOR_EMAIL = "ryushi@gmail.com";

  const mod = await import("@src/config");
  const config = mod.default;
  t.throws(() => config.validate({ allowed: "strict" }));
});

test("config#validate#name", async (t: ExecutionContext) => {
  process.env.GITHUB_TOKEN = "aaaaa";
  process.env.AUTHOR_NAME = "";
  process.env.AUTHOR_EMAIL = "ryushi@gmail.com";

  const mod = await import("@src/config");
  const config = mod.default;
  t.throws(() => config.validate({ allowed: "strict" }));
});

test("config#validate#email", async (t: ExecutionContext) => {
  process.env.GITHUB_TOKEN = "aaaaa";
  process.env.AUTHOR_NAME = "taichi";
  process.env.AUTHOR_EMAIL = "";

  const mod = await import("@src/config");
  const config = mod.default;
  t.throws(() => config.validate({ allowed: "strict" }));
});
