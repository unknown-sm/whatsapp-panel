import test from "node:test";
import assert from "node:assert/strict";
import { withWindowFields } from "../src/services/conversation.service";

const future = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);
const past = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

test("sin ventana registrada no habilita texto libre", () => {
  const result = withWindowFields({ id: "conv-1", contact: { conversationWindow: null } });
  assert.equal(result.windowOpen, false);
  assert.equal(result.windowExpiresAt, null);
  assert.equal(result.freeEntryPointUntil, null);
});

test("una ventana de 24 horas vigente habilita texto libre", () => {
  const expiresAt = future(12);
  const result = withWindowFields({
    id: "conv-1",
    contact: { conversationWindow: { isOpen: true, windowExpiresAt: expiresAt, freeEntryPointUntil: null } },
  });
  assert.equal(result.windowOpen, true);
  assert.equal(result.windowExpiresAt, expiresAt);
});

test("una ventana vencida sin anuncio queda cerrada", () => {
  const expiresAt = past(1);
  const result = withWindowFields({
    id: "conv-1",
    contact: { conversationWindow: { isOpen: true, windowExpiresAt: expiresAt, freeEntryPointUntil: null } },
  });
  assert.equal(result.windowOpen, false);
  assert.equal(result.windowExpiresAt, expiresAt);
});

test("Free Entry Point mantiene texto libre tras vencer la ventana de 24 horas", () => {
  const regularExpiry = past(1);
  const freeEntryPointUntil = future(48);
  const result = withWindowFields({
    id: "conv-1",
    contact: { conversationWindow: { isOpen: false, windowExpiresAt: regularExpiry, freeEntryPointUntil } },
  });
  assert.equal(result.windowOpen, true);
  assert.equal(result.windowExpiresAt, freeEntryPointUntil);
  assert.equal(result.freeEntryPointUntil, freeEntryPointUntil);
});

test("Free Entry Point vencido no reabre una ventana cerrada", () => {
  const result = withWindowFields({
    id: "conv-1",
    contact: { conversationWindow: { isOpen: false, windowExpiresAt: past(25), freeEntryPointUntil: past(1) } },
  });
  assert.equal(result.windowOpen, false);
});
