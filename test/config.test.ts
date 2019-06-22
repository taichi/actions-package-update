import configure from "@src/config";
import test, { ExecutionContext } from "ava";

test("config", async (t: ExecutionContext) => {
  process.env.GITHUB_WORKSPACE = "./";
  const config = await configure();
  const repo = config.get("git").repository;
  t.is(repo.owner, "taichi");
  t.is(repo.name, "actions-package-update");
});
