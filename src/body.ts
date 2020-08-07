import Table, { HorizontalAlignment } from "cli-table3";
import giturl from "git-url-parse";

type PackageType =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies"
  | "bundledDependencies"
  | "bundleDependencies"
  | "shadow";

export type PackageJsonByName = Map<string, PackageJson>;

export class CompareModel {
  public name: string;
  public current: string;
  public wanted: string;
  public packageType: PackageType;
  public repo?: string;
  public homepage?: string;
  public tags: Set<string>;

  constructor(project: PackageJson, o: PackageJson, n: PackageJson) {
    this.name = o.name;
    this.current = o.version;
    this.wanted = n.version;
    this.packageType = this.toPackageType(this.name, project);
    this.repo = this.toURL(o.repository);
    this.homepage = o.homepage;
    this.tags = new Set();
  }

  public rangeWanted() {
    return this.versionRange(this.current, this.wanted);
  }

  public diffWantedURL() {
    return this.diffURL(this.wanted);
  }

  protected toTag(version: string) {
    const v = `v${version}`;
    if (this.tags.has(v)) {
      return v;
    }
    return this.tags.has(version) && version;
  }

  protected diffURL(to: string) {
    if (this.repo) {
      if (this.current === to) {
        const tag = this.toTag(this.current);
        return tag && `${this.repo}/tree/${tag}`;
      }
      const ft = this.toTag(this.current);
      const tt = this.toTag(to);
      return ft && tt && `${this.repo}/compare/${ft}...${tt}`;
    }
    return "";
  }

  protected versionRange(current: string, to: string) {
    if (current === to) {
      return current;
    }
    return `${current}...${to}`;
  }

  protected toPackageType(name: string, pkg: PackageJson): PackageType {
    const contains = (n: string, d?: Dependencies) => d && d[n];
    if (contains(name, pkg.dependencies)) {
      return "dependencies";
    }
    if (contains(name, pkg.devDependencies)) {
      return "devDependencies";
    }
    if (contains(name, pkg.optionalDependencies)) {
      return "optionalDependencies";
    }
    const bundled = pkg.bundledDependencies;
    if (bundled && bundled.find((n: string) => name === n)) {
      return "bundledDependencies";
    }
    const bundle = pkg.bundleDependencies;
    if (bundle && bundle.find((n: string) => name === n)) {
      return "bundleDependencies";
    }
    return "shadow";
  }

  protected toURL(repo?: Repository) {
    if (typeof repo === "string") {
      if (2 === repo.split("/").length) {
        return `https://github.com/${repo}`;
      }
    } else if (repo && repo.url) {
      const u = giturl(repo.url);
      return u && u.toString("https").replace(/\.git$/, "");
    }
  }
}

type ColumnRenderer = (cm: CompareModel) => string;
class Column {
  public name: string;
  public layout: string;
  public render: ColumnRenderer;
  public cliLayout: HorizontalAlignment;
  public cliRender: ColumnRenderer;
  constructor(
    name: string,
    layout: string,
    render: ColumnRenderer,
    cliLayout: HorizontalAlignment,
    cliRender: ColumnRenderer
  ) {
    this.name = name;
    this.layout = layout;
    this.render = render;
    this.cliLayout = cliLayout;
    this.cliRender = cliRender;
  }
}

function makeColumns(entries: CompareModel[]) {
  const columns = [];
  columns.push(
    new Column(
      "Name",
      ":---- ",
      (cw: CompareModel) => {
        return cw.homepage ? `[${cw.name}](${cw.homepage})` : `\`${cw.name}\``;
      },
      "left",
      (cw: CompareModel) => cw.name
    )
  );
  columns.push(
    new Column(
      "Updating",
      ":--------:",
      (cw: CompareModel) => {
        const u = cw.diffWantedURL();
        return u ? `[${cw.rangeWanted()}](${u})` : cw.rangeWanted();
      },
      "center",
      (cw: CompareModel) => cw.rangeWanted()
    )
  );
  const depnames = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "bundledDependencies",
    "bundleDependencies",
    "shadow"
  ];
  depnames.forEach((n: string) => {
    if (entries.find((v: CompareModel) => v.packageType === n)) {
      const fn = (cw: CompareModel) => (cw.packageType === n ? "*" : " ");
      columns.push(new Column(n, ":-:", fn, "center", fn));
    }
  });
  return columns;
}

function headers(columns: Column[]) {
  const a = columns.map((col: Column) => col.name);
  return `| ${a.join(" | ")} |`;
}

function layouts(columns: Column[]) {
  const a = columns.map((col: Column) => col.layout);
  return `| ${a.join(" | ")} |`;
}

function rows(columns: Column[], entries: CompareModel[]) {
  return entries
    .map((c: CompareModel) => {
      const a = columns.map((col: Column) => col.render(c));
      return `| ${a.join(" | ")} |`;
    })
    .join("\n");
}

export function toTextTable(
  project: PackageJson,
  oldone: PackageJsonByName,
  newone: PackageJsonByName
) {
  const models = toCompareModels(project, oldone, newone);
  const columns = makeColumns(models);
  const table = new Table({
    head: columns.map((col: Column) => col.name),
    chars: {
      top: "=",
      "top-mid": "=",
      "top-left": "",
      "top-right": "=",
      bottom: "=",
      "bottom-mid": "=",
      "bottom-left": "",
      "bottom-right": "=",
      left: "|",
      "left-mid": "",
      mid: "-",
      "mid-mid": "-",
      right: "|",
      "right-mid": "",
      middle: "|"
    },
    colAligns: columns.map((col: Column) => col.cliLayout),
    style: {
      head: [],
      "padding-left": 1,
      "padding-right": 1
    }
  });

  models.forEach((c: CompareModel) => {
    table.push(columns.map((col: Column) => col.cliRender(c)));
  });
  return table.toString();
}

export function toMarkdown(
  project: PackageJson,
  oldone: PackageJsonByName,
  newone: PackageJsonByName
) {
  const models = toCompareModels(project, oldone, newone);
  const columns = makeColumns(models);
  return `${headers(columns)}
${layouts(columns)}
${rows(columns, models)}`;
}

function toCompareModels(
  project: PackageJson,
  oldone: PackageJsonByName,
  newone: Map<string, PackageJson>
) {
  return Array.from(oldone.entries())
    .filter(([name, o]: [string, PackageJson]) => {
      const n = newone.get(name);
      return n && n.version && n.version !== o.version;
    })
    .map(([name, o]: [string, PackageJson]) => {
      const n = <PackageJson>newone.get(name);
      return new CompareModel(project, o, n);
    });
}
