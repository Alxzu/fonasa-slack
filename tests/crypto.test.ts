import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "../src/utils/crypto";

const TEST_KEY = randomBytes(32).toString("hex");

describe("encrypt/decrypt", () => {
  test("roundtrip returns original plaintext", () => {
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  test("different inputs produce different ciphertexts", () => {
    const a = encrypt("alpha", TEST_KEY);
    const b = encrypt("bravo", TEST_KEY);
    expect(a).not.toBe(b);
  });

  test("same input produces different ciphertexts (random IV)", () => {
    const a = encrypt("same", TEST_KEY);
    const b = encrypt("same", TEST_KEY);
    expect(a).not.toBe(b);
  });

  test("wrong key fails to decrypt", () => {
    const wrongKey = randomBytes(32).toString("hex");
    const encrypted = encrypt("secret", TEST_KEY);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  test("invalid format throws", () => {
    expect(() => decrypt("not-valid", TEST_KEY)).toThrow(
      "Invalid encrypted format or unsupported key version",
    );
    expect(() => decrypt("v2:a:b:c", TEST_KEY)).toThrow(
      "unsupported key version",
    );
  });

  test("empty string roundtrip", () => {
    const encrypted = encrypt("", TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe("");
  });

  test("unicode roundtrip", () => {
    const unicode = "Hola mundo 🌎 日本語 中文 한국어";
    const encrypted = encrypt(unicode, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(unicode);
  });
});
