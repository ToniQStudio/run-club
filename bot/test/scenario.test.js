import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseFormat,
  createState,
  formatLabel,
  isContact,
  isReady,
  resetState,
  setConsent,
  setName,
  summary
} from "../src/scenario.js";

test("starts at the main menu", () => {
  const state = createState();
  assert.equal(state.step, "start");
  assert.equal(state.format, null);
  assert.equal(state.name, "");
  assert.equal(state.contact, "");
  assert.equal(state.consent, false);
});

test("stage application goes name -> consent without contact", () => {
  let result = chooseFormat(createState(), "stage");
  assert.equal(result.state.step, "name");
  assert.equal(result.state.format, "stage");
  assert.equal(result.state.contactOptional, true);

  result = setName(result.state, "  Анна  ");
  assert.equal(result.state.name, "Анна");
  assert.equal(result.state.step, "consent");

  result = setConsent(result.state, true);
  assert.equal(result.state.step, "confirm");
  assert.equal(result.state.consent, true);
  assert.ok(result.state.consentAt);
  assert.equal(isReady(result.state), true);
  assert.match(summary(result.state), /Заявка в Сборную/);
  assert.match(summary(result.state), /Контакт: Telegram/);
});

test("name validation", () => {
  const state = chooseFormat(createState(), "stage").state;
  const short = setName(state, "Я");
  assert.match(short.error, /хотя бы две буквы/);

  const long = setName(state, "А".repeat(81));
  assert.match(long.error, /слишком длинное/);
});

test("requires consent", () => {
  let state = chooseFormat(createState(), "stage").state;
  state = setName(state, "Анна").state;

  const denied = setConsent(state, false);
  assert.match(denied.error, /Без согласия/);

  const accepted = setConsent(state, true);
  assert.equal(accepted.state.step, "confirm");
});

test("contact validators stay available", () => {
  assert.equal(isContact("+7 999 000-00-00"), true);
  assert.equal(isContact("runner@example.com"), true);
  assert.equal(isContact("@runner_800"), true);
  assert.equal(isContact("просто текст"), false);
});

test("format label is for the stage application", () => {
  assert.equal(formatLabel("stage"), "Заявка в Сборную");
  assert.equal(formatLabel("unknown"), "Не указан");
});

test("reset returns to the main menu", () => {
  const state = resetState();
  assert.equal(state.step, "start");
  assert.equal(state.source, "");
});
