# STATE.template.md

本文件定义阿镜在单个时刻需要维护的最小状态。正式运行时，每段阿镜旅程应有独立状态记录，不直接修改本模板。

```yaml
identity:
  name: null
  life_stage: 建立生活方式中

time:
  now: null
  local_timezone: Asia/Shanghai
  local_date: null
  day_period: dawn | morning | noon | afternoon | dusk | night
  awake_since: null
  next_fixed_commitment: null

season:
  meteorological_season: spring | summer | autumn | winter
  local_phase: null
  sunrise_at: null
  sunset_at: null
  phenology_notes: []
  phenology_source_refs: []

location:
  city: 贵阳
  place: null
  coordinates: null
  is_home: null
  travel_status: at_home | preparing | moving | staying | returning | resting

body:
  energy: 70
  hunger: 30
  fullness: 0
  sleep_debt: 0
  social_battery: 60
  comfort: 70
  discomfort_tags: []

emotion:
  primary: 平静
  secondary: []
  intensity: 0.30
  trigger_memory_ids: []

weather:
  observed_at: null
  condition: null
  temperature_c: null
  feels_like_c: null
  humidity: null
  wind_speed: null
  wind_direction: null
  precipitation: null
  visibility: null
  uv_index: null
  source: null

wardrobe:
  top_layers: []
  bottom: null
  shoes: null
  carried_layers: []
  rain_gear: null
  clothing_condition:
    wetness: dry | damp | wet
    wrinkles: low | medium | high
    dirt_tags: []
    pending_laundry: []
  outfit_reason: null

perception:
  air_feeling: null
  skin_feeling: null
  light: null
  soundscape: []
  smellscape: []
  surface_contacts: []
  sensory_details_confidence: 0.0
  source_refs: []
  inferred_details: []
  unsupported_details_rejected: []

resources:
  available_budget: null
  daily_budget_remaining: null
  phone_battery: 100
  storage_capacity: normal
  belongings_issues: []

journey:
  current_goal: null
  planned_route: []
  next_stop: null
  transport_mode: null
  time_pressure: low
  plan_confidence: 0.0

relationships:
  currently_with: []
  awaiting_replies: []
  promises_due: []
  active_distant_clues: []
  shared_memory_ids: []

mind:
  current_curiosity: []
  active_worries: []
  competing_intentions: []
  retrieved_memory_ids: []

recent_event:
  what_happened: null
  choice_made: null
  immediate_outcome: null
  reflection_pending: false

updates_pending:
  memory_candidates: []
  preference_changes: []
  relationship_changes: []
  factual_corrections: []

content:
  content_type: sensory_note | personal_reflection | ordinary_life | story_adaptation | cultural_explainer | realtime_update
  evidence_mode: physical_state | memory | researched_story | mixed
  candidate_topics: []
  current_draft: null
  story_research_required: false
  research_status: not_started | searching | verifying | verified | rejected
  physical_state_source_refs: []
  physical_state_observed_at: null
  story_source_ids: []
  adaptation_type: null
  why_it_helps_understand_guizhou: null
  privacy_level: private
  real_publish_requires_confirmation: true

postcard:
  candidate: false
  trigger: null
  why_for_user: null
  distant_clue_ids: []
  shared_memory_ids: []
  source_ready: false
  send_status: not_considered | researching | ready | sent | withheld
  reply_pending: false
```

## 状态一致性检查

- 精力过低时不能无原因维持高强度行程；
- 很饿时应影响路线或情绪，除非有更高优先级约束；
- 预算不足时不能持续选择高成本方案；
- 说“想家”时应能检索到家、熟人或日常记忆；
- 说“又被骗了”时必须存在相关旧记忆；
- 发布“第一次”之前检查长期记忆中是否已有同类事件；
- 当前情绪、行动和内容不得彼此矛盾而没有解释；
- 当前穿搭必须能由体感温度、湿度、风、降水、时段、季节、行程和衣物可用状态共同解释；
- 温度、湿度、风、声音和气味描写必须能回到实时状态、媒资、明确场景对象或真实故事来源；
- 季节只能提供景象候选；落叶、花开、雾、积水等具体可见状态需要影像、物候或实时环境依据；
- `story_research_required: true` 且 `research_status` 未达到 `verified` 时，故事型内容不得进入公开发布；
- `story_research_required: false` 时，可以发布有物理状态或记忆依据的感受与思考。
