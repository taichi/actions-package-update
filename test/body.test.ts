import { CompareModel, toMarkdown } from "@src/body.ts";
import { readJson } from "@src/promisify";
import test, { ExecutionContext } from "ava";


test("toMarkdown", async (t: ExecutionContext) => {
  const names = ["classnames", "react-dom", "react"];

  const ps = names.map((n: string) => {
    const prefix = "test/fixture/body/";
    const suffix = ".package.json";
    return [
      `${prefix}old/${n}${suffix}`,
      `${prefix}new/${n}${suffix}`
    ];
  }).map(([oldone, newone]: string[]) => {
    return [
      readJson(oldone),
      readJson(newone)
    ];
  }).map(async (value: Promise<PackageJson>[]) => {
    return Promise.all(value).then((values: PackageJson[]) => {
      return new CompareModel(values[0], values[1]);
    }).catch((err: Error) => {
      t.fail(err.message);
      throw err;
    });
  });

  const models = await Promise.all(ps);

  const md = toMarkdown(models);
  t.is(md, `## Updating Dependencies
| Name | Updating | shadow |
| :----  | :--------: | :-: |
| [classnames](https://github.com/JedWatson/classnames#readme) | 2.2.0...2.2.6 | * |
| [react-dom](https://facebook.github.io/react/) | 15.0.0...16.8.6 | * |
| [react](https://facebook.github.io/react/) | 15.0.0...16.8.6 | * |

Powered by [actions-package-update](https://github.com/taichi/actions-package-update)`);
});

