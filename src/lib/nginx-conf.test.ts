import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const NOSNIFF = "add_header X-Content-Type-Options nosniff always;";
const REFERRER_POLICY = "add_header Referrer-Policy strict-origin-when-cross-origin always;";
const SERVER_TOKENS_OFF = /^\s*server_tokens\s+off;/m;

const nginxConf = readFileSync(new URL("../../nginx.conf", import.meta.url), "utf8")
  .replace(/#.*$/gm, "");

const [serverBlock, ...locationBlocks] = nginxConf.split(/^\s*location\s/m);
const locationBlocksWithHeaders = locationBlocks.filter((block) => block.includes("add_header"));

describe("nginx.conf", () => {
  it("hides the nginx version at the server level", () => {
    expect(serverBlock).toMatch(SERVER_TOKENS_OFF);
  });

  it("sets X-Content-Type-Options at the server level", () => {
    expect(serverBlock).toContain(NOSNIFF);
  });

  it("sets Referrer-Policy at the server level", () => {
    expect(serverBlock).toContain(REFERRER_POLICY);
  });

  // A location-level add_header drops every header inherited from the server block.
  it.each(locationBlocksWithHeaders)(
    "re-declares X-Content-Type-Options in location %s",
    (block) => {
      expect(block).toContain(NOSNIFF);
    },
  );

  it.each(locationBlocksWithHeaders)(
    "re-declares Referrer-Policy in location %s",
    (block) => {
      expect(block).toContain(REFERRER_POLICY);
    },
  );
});
