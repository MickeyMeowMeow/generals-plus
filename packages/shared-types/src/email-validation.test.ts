import { describe, expect, it } from "vitest";

import {
  EMAIL_LOCAL_PART_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  isValidEmail,
} from "./email-validation";

describe("isValidEmail", () => {
  // ── Valid addresses ──────────────────────────────────────────────────

  describe("valid emails", () => {
    it("accepts a simple address", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("accepts a subdomain address", () => {
      expect(isValidEmail("user@mail.example.com")).toBe(true);
    });

    it("accepts digits in local part", () => {
      expect(isValidEmail("user123@example.com")).toBe(true);
    });

    it("accepts hyphens in domain", () => {
      expect(isValidEmail("user@my-domain.com")).toBe(true);
    });

    it("accepts dots in local part", () => {
      expect(isValidEmail("first.last@example.com")).toBe(true);
    });

    it("accepts plus sign in local part", () => {
      expect(isValidEmail("user+tag@example.com")).toBe(true);
    });

    it("accepts common special characters in local part", () => {
      expect(isValidEmail("user!#$%&'*-/=?^_`{|}~@example.com")).toBe(true);
    });

    it("accepts single-character local part", () => {
      expect(isValidEmail("a@example.com")).toBe(true);
    });

    it("accepts two-letter TLD", () => {
      expect(isValidEmail("user@example.io")).toBe(true);
    });

    it("accepts long TLD (63 chars)", () => {
      const tld = "a".repeat(63);
      expect(isValidEmail(`user@example.${tld}`)).toBe(true);
    });

    it("accepts the maximum total length (254 chars)", () => {
      const local = "a".repeat(10);
      // domain needs: 254 - 10 (local) - 1 (@) = 243 chars
      // 4 labels × 60 chars + 3 dots + ".com" = 243 + 4 = 247 — too long
      // Build domain to exactly 243 chars
      const domain = `${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(56)}.com`;
      const email = `${local}@${domain}`;
      expect(email.length).toBe(EMAIL_MAX_LENGTH);
      expect(isValidEmail(email)).toBe(true);
    });

    it("accepts maximum local part length (64 chars)", () => {
      const local = "a".repeat(EMAIL_LOCAL_PART_MAX_LENGTH);
      expect(isValidEmail(`${local}@example.com`)).toBe(true);
    });
  });

  // ── Invalid addresses ────────────────────────────────────────────────

  describe("invalid emails", () => {
    it("rejects empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("rejects missing @", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    it("rejects missing local part", () => {
      expect(isValidEmail("@example.com")).toBe(false);
    });

    it("rejects missing domain", () => {
      expect(isValidEmail("user@")).toBe(false);
    });

    it("rejects missing TLD", () => {
      expect(isValidEmail("user@example")).toBe(false);
    });

    it("rejects TLD that is too short (1 char)", () => {
      expect(isValidEmail("user@example.a")).toBe(false);
    });

    it("rejects TLD that is too long (64 chars)", () => {
      const tld = "a".repeat(64);
      expect(isValidEmail(`user@example.${tld}`)).toBe(false);
    });

    it("rejects spaces in local part", () => {
      expect(isValidEmail("user name@example.com")).toBe(false);
    });

    it("rejects spaces in domain", () => {
      expect(isValidEmail("user@exa mple.com")).toBe(false);
    });

    it("rejects leading dot in local part", () => {
      expect(isValidEmail(".user@example.com")).toBe(false);
    });

    it("rejects trailing dot in local part", () => {
      expect(isValidEmail("user.@example.com")).toBe(false);
    });

    it("rejects consecutive dots in local part", () => {
      expect(isValidEmail("user..name@example.com")).toBe(false);
    });

    it("rejects local part exceeding 64 chars", () => {
      const local = "a".repeat(EMAIL_LOCAL_PART_MAX_LENGTH + 1);
      expect(isValidEmail(`${local}@example.com`)).toBe(false);
    });

    it("rejects total length exceeding 254 chars", () => {
      const local = "a".repeat(10);
      const domain = `${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(57)}.com`;
      const email = `${local}@${domain}`;
      expect(email.length).toBe(EMAIL_MAX_LENGTH + 1);
      expect(isValidEmail(email)).toBe(false);
    });

    it("rejects domain label starting with hyphen", () => {
      expect(isValidEmail("user@-example.com")).toBe(false);
    });

    it("rejects domain label ending with hyphen", () => {
      expect(isValidEmail("user@example-.com")).toBe(false);
    });

    it("rejects domain label exceeding 63 chars", () => {
      const label = "a".repeat(64);
      expect(isValidEmail(`user@${label}.com`)).toBe(false);
    });

    it("rejects double @ sign", () => {
      expect(isValidEmail("user@@example.com")).toBe(false);
    });

    it("rejects parentheses in local part", () => {
      expect(isValidEmail("user(comment)@example.com")).toBe(false);
    });

    it("rejects square brackets in local part", () => {
      expect(isValidEmail("user[name]@example.com")).toBe(false);
    });

    it("rejects comma in local part", () => {
      expect(isValidEmail("user,name@example.com")).toBe(false);
    });

    it("rejects semicolon in local part", () => {
      expect(isValidEmail("user;name@example.com")).toBe(false);
    });

    it("rejects colon in local part", () => {
      expect(isValidEmail("user:name@example.com")).toBe(false);
    });

    it("rejects double quotes", () => {
      expect(isValidEmail('"user"@example.com')).toBe(false);
    });
  });
});
