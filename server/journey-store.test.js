"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createJourneyStore, assertJourneyId } = require("./journey-store");

test("旅程存储可以创建、更新、恢复并保存私有媒体", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-journey-store-"));
  const store = createJourneyStore({ rootDir, now: () => new Date("2026-08-29T08:00:00.000Z") });
  try {
    const journey = store.create({ mode: "步行", pace: "快速云游" });
    assert.equal(journey.settings.mode, "步行");
    assert.equal(journey.settings.commission, "");
    assert.equal(journey.events[0].title, "旅程已经建立");
    assert.doesNotMatch(journey.events[0].summary, /你|用户|线索/);
    assert.equal(store.read(journey.id).status, "active");
    const updated = store.update(journey.id, (draft) => {
      draft.entries.push({ id: "entry-1", locationId: "guiyang" });
      return draft;
    });
    assert.equal(updated.entries.length, 1);
    const jpeg = Buffer.alloc(256, 0);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff;
    const filename = store.writeMedia(journey.id, jpeg, "jpg");
    const media = store.resolveMedia(journey.id, filename);
    assert.equal(media.size, 256);
    assert.equal(media.extension, "jpg");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("旅程与媒体编号拒绝路径穿越", () => {
  assert.throws(() => assertJourneyId("../../etc/passwd"), /invalid_journey_id/);
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-journey-store-"));
  const store = createJourneyStore({ rootDir });
  try {
    const journey = store.create();
    assert.throws(() => store.resolveMedia(journey.id, "../journey.json"), /invalid_media_name/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("正式旅程可以从经过筛选的贵州地点随机落脚，并保存旅程起点", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-random-start-"));
  const store = createJourneyStore({
    rootDir,
    random: () => 0.5,
    now: () => new Date("2026-08-29T08:00:00.000Z")
  });
  try {
    const journey = store.create();
    assert.deepEqual(journey.route, ["zunyi"]);
    assert.equal(journey.state.originLocationId, "zunyi");
    assert.equal(journey.state.currentLocationId, "zunyi");
    assert.match(journey.events[0].summary, /遵义老城/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
