"use client";

import { useEffect } from "react";

type DeviceType = "mobile" | "tablet" | "desktop";
type OsType = "ios" | "android" | "windows" | "macos" | "linux" | "unknown";
type BrowserType = "safari" | "chrome" | "firefox" | "edge" | "opera" | "samsung" | "unknown";

function detectOS(ua: string): OsType {
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows nt/i.test(ua)) return "windows";
  if (/mac os x|macintosh/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "unknown";
}

function detectBrowser(ua: string): BrowserType {
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/edg\//i.test(ua)) return "edge";
  if (/opr\//i.test(ua)) return "opera";
  if (/firefox\//i.test(ua)) return "firefox";
  if (/chrome\//i.test(ua)) return "chrome";
  if (/safari\//i.test(ua) && !/chrome|chromium|crios|android/i.test(ua)) return "safari";
  return "unknown";
}

function detectDeviceType(ua: string): DeviceType {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function parseModelFromUA(ua: string): string | undefined {
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";

  const androidModel = ua.match(/android\s[\d.]+;\s*([^;)]+)(?:\)|;)/i)?.[1]?.trim();
  if (androidModel && androidModel.length > 1) return androidModel;

  const samsung = ua.match(/\bSM-[A-Z0-9]+\b/i)?.[0];
  if (samsung) return samsung;

  const pixel = ua.match(/\bPixel\s+[\w\d\s]+\b/i)?.[0]?.trim();
  if (pixel) return pixel;

  return undefined;
}

export function DeviceAwareness() {
  useEffect(() => {
    const html = document.documentElement;
    const nav = navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
      };
    };

    const ua = navigator.userAgent || "";
    const os = detectOS(ua);
    const browser = detectBrowser(ua);
    const device = detectDeviceType(ua);

    const apply = (model?: string) => {
      const touch = matchMedia("(hover: none), (pointer: coarse)").matches;
      // Treat as mobile when UA says so, OR when the viewport is narrow + touch is present
      // (handles unusual UAs on real mobile hardware)
      const narrowTouchViewport = touch && window.innerWidth < 768;
      const isMobile = device === "mobile" || narrowTouchViewport;

      html.dataset.os = os;
      html.dataset.browser = browser;
      html.dataset.device = device;
      html.dataset.touch = touch ? "true" : "false";
      if (model) html.dataset.model = model;

      html.classList.toggle("is-mobile", isMobile);
      html.classList.toggle("is-tablet", device === "tablet" && !narrowTouchViewport);
      html.classList.toggle("is-desktop", !isMobile);

      html.classList.toggle("os-ios", os === "ios");
      html.classList.toggle("os-android", os === "android");

      html.classList.toggle("browser-safari", browser === "safari");
      html.classList.toggle("browser-chrome", browser === "chrome");
    };

    const fallbackModel = parseModelFromUA(ua);

    const initialize = () => {
      if (nav.userAgentData?.getHighEntropyValues) {
        nav.userAgentData
          .getHighEntropyValues(["model"])
          .then((data) => apply(data.model || fallbackModel))
          .catch(() => apply(fallbackModel));
        return;
      }
      apply(fallbackModel);
    };

    initialize();

    // Re-evaluate on viewport resize so orientation changes and window resizes stay accurate
    const onResize = () => apply(html.dataset.model);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return null;
}
