import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEcuadorMobilePhone,
  parseExternalPhoneValues,
} from "./ghlBroadcastPhones.js";

test("acepta formato nacional e internacional con espacios como un mismo destinatario", () => {
  assert.equal(normalizeEcuadorMobilePhone("0999001413"), "+593999001413");
  assert.equal(normalizeEcuadorMobilePhone("+593 999 900 1413"), "+593999001413");
  assert.equal(normalizeEcuadorMobilePhone("+593 999 001 413"), "+593999001413");
  assert.deepEqual(
    parseExternalPhoneValues("0999001413\n+593 999 900 1413"),
    ["+593999001413"],
  );
});

test("lee varios telefonos completos en una linea y no acepta un prefijo de un numero largo", () => {
  assert.deepEqual(
    parseExternalPhoneValues("0999001413 +593 987 654 321, +5939999001413"),
    ["+593999001413", "+593987654321"],
  );
  assert.deepEqual(parseExternalPhoneValues("+593 912 345 6789"), []);
});
