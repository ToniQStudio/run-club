import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseFormat,
  createPassId,
  createState,
  formatLabel,
  isContact,
  isReady,
  resetState,
  setConsent,
  setContact,
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

test("open training goes name -> consent without contact", () => {
  let result = chooseFormat(createState(), "open");
  assert.equal(result.state.step, "name");
  assert.equal(result.state.format, "open");
  assert.equal(result.state.contactOptional, true);

  result = setName(result.state, "  Анна  ");
  assert.equal(result.state.name, "Анна");
  assert.equal(result.state.step, "consent");

  result = setConsent(result.state, true);
  assert.equal(result.state.step, "confirm");
  assert.equal(result.state.consent, true);
  assert.ok(result.state.consentAt);
  assert.equal(isReady(result.state), true);
  assert.match(summary(result.state), /Открытая тренировка/);
  assert.match(summary(result.state), /не оставлен/);
});

test("paid format requires a contact", () => {
  let result = chooseFormat(createState(), "club");
  assert.equal(result.state.step, "name");
  assert.equal(result.state.contactOptional, false);

  result = setName(result.state, "Илья");
  assert.equal(result.state.step, "contact");

  const bad = setContact(result.state, "привет");
  assert.match(bad.error, /Похоже на опечатку/);

  const phone = setContact(result.state, "+7 999 000-00-00");
  assert.equal(phone.state.step, "consent");

  const email = setContact(result.state, "runner@example.com");
  assert.equal(email.state.step, "consent");

  const telegram = setContact(result.state, "@runner_800");
  assert.equal(telegram.state.step, "consent");
});

test("paid lead is ready only with contact and consent", () => {
  let state = chooseFormat(createState(), "personal").state;
  state = setName(state, "Илья").state;
  assert.equal(isReady(state), false);

  state = setContact(state, "@ilya_run").state;
  state = setConsent(state, true).state;

  assert.equal(isReady(state), true);
  assert.match(summary(state), /Персональная тренировка/);
  assert.match(summary(state), /@ilya_run/);
  assert.equal(formatLabel("club"), "Клуб");
});

test("contact validators", () => {
  assert.equal(isContact("+7 999 000-00-00"), true);
  assert.equal(isContact("runner@example.com"), true);
  assert.equal(isContact("@runner_800"), true);
  assert.equal(isContact("просто текст"), false);
});

test("pass id has the expected format", () => {
  const pass = createPassId();
  assert.match(pass, /^YB800-[A-Z2-9]{8}$/);
});

test("requires consent", () => {
  let state = chooseFormat(createState(), "open").state;
  state = setName(state, "Анна").state;

  const denied = setConsent(state, false);
  assert.match(denied.error, /Без согласия/);

  const accepted = setConsent(state, true);
  assert.equal(accepted.state.step, "confirm");
});

test("reset returns to the main menu", () => {
  const state = resetState();
  assert.equal(state.step, "start");
  assert.equal(state.source, "");
});
