"use strict";

let runtimePromise;

function loadRuntime() {
  runtimePromise ||= import("./pi-runtime.mjs");
  return runtimePromise;
}

async function runAjingDecision(options) {
  const runtime = await loadRuntime();
  return runtime.runAjingDecision(options);
}

module.exports = { runAjingDecision, loadRuntime };
