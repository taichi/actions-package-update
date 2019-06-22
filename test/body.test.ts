import { toMarkdown, toTextTable } from "@src/body.ts";
import { readJson } from "@src/promisify";
import test, { ExecutionContext } from "ava";
import strip from "strip-ansi";


test("toMarkdown", async (t: ExecutionContext) => {
  const [oldone, newone] = await setup();

  const md = toMarkdown(oldone, newone);
  t.is(md, `## Updating Dependencies
| Name | Updating | shadow |
| :----  | :--------: | :-: |
| [classnames](https://github.com/JedWatson/classnames#readme) | 2.2.0...2.2.6 | * |
| [react-dom](https://facebook.github.io/react/) | 15.0.0...16.8.6 | * |
| [react](https://facebook.github.io/react/) | 15.0.0...16.8.6 | * |

Powered by [actions-package-update](https://github.com/taichi/actions-package-update)`);
});

async function setup(): Promise<Map<string, PackageJson>[]> {
  const names = ["classnames", "react-dom", "react"];
  const toPkgMap = async (s: string) => {
    const m = new Map;
    const ary = names.map((n: string) => {
      return `test/fixture/body/${s}/${n}.package.json`;
    }).map(readJson);
    for await (const pkg of ary) {
      m.set(pkg.name, pkg);
    }
    return m;
  };

  const oldone = await toPkgMap("old");
  const newone = await toPkgMap("new");
  return [oldone, newone];
}

test("toTextTable", async (t: ExecutionContext) => {
  const [oldone, newone] = await setup();

  const actual = toTextTable(oldone, newone).split(/[\r]?\n/);

  const expected = `========================================
| Name       |    Updating     | shadow |
---------------------------------------
| classnames |  2.2.0...2.2.6  |   *    |
---------------------------------------
| react-dom  | 15.0.0...16.8.6 |   *    |
---------------------------------------
| react      | 15.0.0...16.8.6 |   *    |
========================================`.split(/[\r]?\n/);

  actual.forEach((line: string, i: number) => {
    t.is(strip(line), expected[i]);
  });
});
