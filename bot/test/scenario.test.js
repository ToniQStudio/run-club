import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseFormat,
  choosePath,
  createState,
  formatLabel,
  isReady,
  pathLabel,
  resetState,
  setConsent,
  setContact,
  setName,
  summary
} from "../src/scenario.js";

test("starts at path selection", () => {
  const state = createState();
  assert.equal(state.step, "path");
  assert.equal(state.path, null);
  assert.equal(state.format, null);
});

test("chooses a path and moves to format", () => {
  const result = choosePath(createState(), "beginner");
  assert.equal(result.state.step, "format");
  assert.equal(result.state.path, "beginner");
  assert.equal(result.error, undefined);
});

test("rejects an unknown path", () => {
  const result = choosePath(createState(), "unknown");
  assert.match(result.error, /Неизвестный путь/);
});

test("chooses a format and moves to name", () => {
  const result = chooseFormat(createState(), "club");
  assert.equal(result.state.step, "name");
  assert.equal(result.state.format, "club");
});

test("validates name", () => {
  const short = setName(createState(), "A");
  assert.match(short.error, /хотя бы две/);

  const good = setName(createState(), "  Анна  ");
  assert.equal(good.state.name, "Анна");
  assert.equal(good.state.step, "contact");
});

test("validates phone and Telegram contact", () => {
  const bad = setContact(createState(), "привет");
  assert.match(bad.error, /Похоже на опечатку/);

  const phone = setContact(createState(), "+7 999 000-00-00");
  assert.equal(phone.state.step, "consent");

  const telegram = setContact(createState(), "@runner_800");
  assert.equal(telegram.state.step, "consent");
});

test("requires consent", () => {
  const denied = setConsent(createState(), false);
  assert.match(denied.error, /Без согласия/);

  const accepted = setConsent(createState(), true);
  assert.equal(accepted.state.step, "confirm");
  assert.equal(accepted.state.consent, true);
  assert.ok(accepted.state.consentAt);
});

test("becomes ready only after full flow", () => {
  let state = createState();
  assert.equal(isReady(state), false);

  state = choosePath(state, "performance").state;
  state = chooseFormat(state, "personal").state;
  state = setName(state, "Илья").state;
  state = setContact(state, "@ilya_run").state;
  state = setConsent(state, true).state;

  assert.equal(isReady(state), true);
  assert.match(summary(state), /Персональная тренировка/);
  assert.match(summary(state), /Личный рекорд/);
  assert.equal(formatLabel("club"), "Клуб");
  assert.equal(pathLabel("beginner"), "Первый километр");
});

test("reset returns to initial state", () => {
  const state = resetState();
  assert.equal(state.step, "path");
  assert.equal(state.source, "");
});
