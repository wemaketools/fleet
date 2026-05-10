import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadCollisionModule() {
  const source = readFileSync(join(root, "lib/simulator/collision.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  });
  return cjsModule.exports;
}

test("collision rerouting avoids occupied road segments", () => {
  const { findPathAvoidingOccupiedSegments, roadSegmentKey } =
    loadCollisionModule();
  const graph = {
    neighbors(id) {
      return (
        {
          A: [
            { to: "B", edge: { lengthMeters: 10 } },
            { to: "C", edge: { lengthMeters: 8 } },
          ],
          C: [{ to: "B", edge: { lengthMeters: 8 } }],
          B: [],
        }[id] ?? []
      );
    },
  };

  const path = findPathAvoidingOccupiedSegments(
    graph,
    "A",
    "B",
    new Set([roadSegmentKey("A", "B")]),
  );

  assert.deepEqual(Array.from(path), ["A", "C", "B"]);
});

test("collision fallback preserves minimum spacing behind a lead vehicle", () => {
  const { constrainProgressForSpacing } = loadCollisionModule();

  const progress = constrainProgressForSpacing({
    truckId: "follower",
    fromId: "A",
    toId: "B",
    currentProgressMeters: 30,
    desiredProgressMeters: 55,
    edgeLengthMeters: 100,
    occupants: [
      {
        truckId: "leader",
        fromId: "A",
        toId: "B",
        progressMeters: 70,
      },
    ],
    minSpacingMeters: 28,
  });

  assert.equal(progress, 42);
});
