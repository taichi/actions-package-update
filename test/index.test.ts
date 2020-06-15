import test, { ExecutionContext } from "ava";

test.before(async (t: ExecutionContext) => {
  t.log(new Date());
});

test("test", async (t: ExecutionContext) => {
  t.is("A", "A");
});
