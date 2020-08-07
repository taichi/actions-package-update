import { toMarkdown, toTextTable } from "@src/body.ts";
import { readJson } from "@src/promisify";
import test, { ExecutionContext } from "ava";
import strip from "strip-ansi";

test("toMarkdown", async (t: ExecutionContext) => {
  const [project, oldone, newone] = await setup();

  const actual = toMarkdown(project, oldone, newone);
  t.is(
    actual,
    `| Name | Updating | dependencies |
| :----  | :--------: | :-: |
| [classnames](https://github.com/JedWatson/classnames#readme) | 2.2.0...2.2.6 | * |
| [react-dom](https://facebook.github.io/react/) | 15.0.0...16.8.6 | * |
| [react](https://facebook.github.io/react/) | 15.0.0...16.8.6 | * |`
  );
});

async function setup(): Promise<
  [PackageJson, Map<string, PackageJson>, Map<string, PackageJson>]
> {
  const names = ["classnames", "react-dom", "react"];
  const toPkgMap = async (s: string) => {
    const m = new Map();
    const ary = names
      .map((n: string) => {
        return `test/fixture/body/${s}/${n}.package.json`;
      })
      .map(readJson);
    for await (const pkg of ary) {
      m.set(pkg.name, pkg);
    }
    return m;
  };

  const oldone = await toPkgMap("old");
  const newone = await toPkgMap("new");

  const project = await readJson("test/fixture/body/package.json");
  return [project, oldone, newone];
}

test("toTextTable", async (t: ExecutionContext) => {
  const [project, oldone, newone] = await setup();

  const actual = toTextTable(project, oldone, newone);
  t.is(
    strip(actual),
    `==============================================
| Name       |    Updating     | dependencies |
---------------------------------------------
| classnames |  2.2.0...2.2.6  |      *       |
---------------------------------------------
| react-dom  | 15.0.0...16.8.6 |      *       |
---------------------------------------------
| react      | 15.0.0...16.8.6 |      *       |
==============================================`
  );
});
