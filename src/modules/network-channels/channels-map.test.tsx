// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { buildPopup, geoipUrl } from "./channels-map";

afterEach(() => {
  delete window.__ENV__;
});

describe("channels map: geolocation endpoint", () => {
  it("is disabled when not configured", () => {
    window.__ENV__ = {};

    expect(geoipUrl()).toBeNull();
  });

  it("ignores a plain http endpoint", () => {
    window.__ENV__ = { GEOIP_URL: "http://ip-api.com/batch" };

    expect(geoipUrl()).toBeNull();
  });

  it("uses a configured https endpoint", () => {
    window.__ENV__ = { GEOIP_URL: "https://geoip.example.com/batch" };

    expect(geoipUrl()).toBe("https://geoip.example.com/batch");
  });
});

describe("channels map: popup", () => {
  it("renders the geolocation answer as text, not HTML", () => {
    const popup = buildPopup(
      { ip: "1.2.3.4", lat: 0, lon: 0, city: "<img src=x onerror=alert(1)>", country: "<b>FR</b>" },
      2,
    );

    expect(popup.querySelector("img")).toBeNull();
    expect(popup.textContent).toBe("1.2.3.4<img src=x onerror=alert(1)>, <b>FR</b>2 connections");
  });
});
