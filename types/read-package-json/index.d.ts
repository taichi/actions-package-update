interface Dependencies {
  [name: string]: string;
}
declare type PackageBin = string | {
  [commandName: string]: string;
};
declare type Repository = string | {
  type: string;
  url: string;
};
declare interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  homepage?: string;
  repository?: Repository;
  bin?: PackageBin;
  directories?: {
    bin?: string;
  };
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  bundleDependencies?: string[];
  bundledDependencies?: string[];
  config?: object;
}

declare module "read-package-json" {
  export default function (filename: string, log: Console, strict: boolean, cb: (error: Error, data: PackageJson) => void): void;
  export default function (filename: string, strict: boolean, cb: (error: Error, data: PackageJson) => void): void;
  export default function (filename: string, cb: (error: Error, data: PackageJson) => void): void;
}
