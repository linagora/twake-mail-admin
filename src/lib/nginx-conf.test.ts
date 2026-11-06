import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const NOSNIFF = "add_header X-Content-Type-Options nosniff always;";

const nginxConf = readFileSync(new URL("../../nginx.conf", import.meta.url), "utf8")
  .replace(/#.*$/gm, "");

const [serverBlock, ...locationBlocks] = nginxConf.split(/^\s*location\s/m);

describe("nginx.conf", () => {
  it("sets X-Content-Type-Options at the server level", () => {
    expect(serverBlock).toContain(NOSNIFF);
  });

  // A location-level add_header drops every header inherited from the server block.
  it.each(locationBlocks.filter((block) => block.includes("add_header")))(
    "re-declares X-Content-Type-Options in location %s",
    (block) => {
      expect(block).toContain(NOSNIFF);
    },
  );
});
