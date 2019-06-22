import configure from "./config";
import Processor from "./main";

async function main() {
  const config = await configure();
  config.validate({ allowed: "strict" });
  const processor = new Processor(config);
  const result = await processor.run();
  config.logger.info(result);
  process.exit(0);
}

main().catch((err: Error) => {
  // tslint:disable-next-line: no-console
  console.error(err);
  process.exit(1);
});

