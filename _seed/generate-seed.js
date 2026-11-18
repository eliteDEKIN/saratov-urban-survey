// Генератор тестовых данных для анкеты «Городская среда — Саратов»
// Схема таблицы public.survey_responses:
//   gender, age, district, transport, roads, landscaping, safety, lighting, ecology, created_at
//
// Версия 2: квотная выборка по реальным пропорциям Саратова.
//
// Опора на открытые данные:
//  1) Численность населения по внутригородским районам — Росстат, оценка на 01.01.2021
//     (сводка: https://www.statdata.ru/naselenie/saratov, всего 830 155 чел.)
//  2) Пол: 46,4% мужчин / 53,6% женщин — доля по Саратовской области, 2024
//     (https://saratov.awdb.ru)
//  3) Возрастная структура: РФ 2024 — моложе трудоспособного 18,4%, трудоспособное 58,0%,
//     старше трудоспособного 23,6% (https://mojgorod.ru/stat/region/tabR0105.html)
//     Саратовская область старше среднероссийской, поэтому сдвиг в сторону 45+.
//  4) Проблемные темы по районам — городские новости (дороги в Ленинском, экология в Заводском,
//     благоустройство набережной в Волжском).

const fs = require('fs');
const path = require('path');

// Детерминированный ПСЧ (mulberry32) — данные воспроизводимы
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261116);

const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// 1. Районы: вес = доля реального населения (Росстат, 01.01.2021)
// ---------------------------------------------------------------------------
const DISTRICTS = [
  { name: 'Волжский',    pop: 68766  }, // 8,3%
  { name: 'Заводской',   pop: 190530 }, // 23,0%
  { name: 'Кировский',   pop: 132856 }, // 16,0%
  { name: 'Ленинский',   pop: 273240 }, // 32,9%
  { name: 'Октябрьский', pop: 116073 }, // 14,0%
  { name: 'Фрунзенский', pop: 48690  }, // 5,9%
];
const POP_TOTAL = DISTRICTS.reduce((s, d) => s + d.pop, 0); // 830 155

// ---------------------------------------------------------------------------
// 2. Возраст: структура населения × поправка на смещение онлайн-анкеты
//    (молодёжь отвечает охотнее, 65+ почти не участвует в веб-опросах)
// ---------------------------------------------------------------------------
const AGE_GROUPS = [
  { key: '14-17', min: 14, max: 17, share: 0.045, bias: 0.60 },
  { key: '18-24', min: 18, max: 24, share: 0.090, bias: 1.50 },
  { key: '25-34', min: 25, max: 34, share: 0.160, bias: 1.60 },
  { key: '35-44', min: 35, max: 44, share: 0.190, bias: 1.40 },
  { key: '45-54', min: 45, max: 54, share: 0.160, bias: 1.10 },
  { key: '55-64', min: 55, max: 64, share: 0.150, bias: 0.70 },
  { key: '65+',   min: 65, max: 88, share: 0.205, bias: 0.35 },
];

// ---------------------------------------------------------------------------
// 3. Оценки: средние по городу + поправка района по каждой теме отдельно
//    (не одно общее смещение, а своя проблема в каждом районе)
// ---------------------------------------------------------------------------
const BASE_MEAN = {
  transport:   3.2, // схема маршрутов, перекрытия из-за скоростного трамвая
  roads:       2.8, // ямы, «полоса препятствий» — самая болевая тема
  landscaping: 3.5, // благоустройство неравномерно: центр и набережная лучше
  safety:      3.4,
  lighting:    3.3,
  ecology:     2.9, // выбросы НПЗ, овраги
};

const DISTRICT_ADJ = {
  // центр, обновлённая набережная — стабильно выше среднего
  'Волжский':    { transport:  0.40, roads:  0.50, landscaping:  0.70, safety:  0.40, lighting:  0.50, ecology:  0.30 },
  // исторический центр, наиболее благополучный по среде
  'Фрунзенский': { transport:  0.45, roads:  0.45, landscaping:  0.60, safety:  0.50, lighting:  0.50, ecology:  0.25 },
  // смешанная застройка, «средний» район
  'Октябрьский': { transport:  0.15, roads:  0.10, landscaping:  0.15, safety:  0.15, lighting:  0.15, ecology:  0.05 },
  // промышленность + жилые массивы
  'Кировский':   { transport: -0.05, roads: -0.10, landscaping: -0.05, safety: -0.10, lighting:  0.00, ecology: -0.15 },
  // самый населённый, худшие дороги
  'Ленинский':   { transport: -0.30, roads: -0.55, landscaping: -0.25, safety: -0.25, lighting: -0.20, ecology: -0.35 },
  // промышленная окраина: НПЗ, экология и дороги хуже всего
  'Заводской':   { transport: -0.35, roads: -0.50, landscaping: -0.40, safety: -0.35, lighting: -0.30, ecology: -0.65 },
};

const TOPICS = ['transport', 'roads', 'landscaping', 'safety', 'lighting', 'ecology'];

// Возраст слегка меняет оптику: молодёжь строже к безопасности,
// старшие — к благоустройству и транспорту.
const AGE_ADJ = {
  '14-17': { transport:  0.15, safety: -0.10, landscaping:  0.00, roads: 0.00, lighting: 0.00, ecology: 0.05 },
  '18-24': { transport:  0.10, safety: -0.10, landscaping:  0.00, roads: 0.00, lighting: 0.00, ecology: 0.05 },
  '25-34': { transport:  0.00, safety:  0.00, landscaping:  0.00, roads: 0.00, lighting: 0.00, ecology: 0.00 },
  '35-44': { transport:  0.00, safety:  0.05, landscaping:  0.00, roads: 0.00, lighting: 0.00, ecology: 0.00 },
  '45-54': { transport:  0.05, safety:  0.10, landscaping: -0.05, roads: 0.00, lighting: 0.00, ecology: 0.00 },
  '55-64': { transport:  0.10, safety:  0.15, landscaping: -0.10, roads: 0.00, lighting: 0.00, ecology: 0.00 },
  '65+':   { transport:  0.10, safety:  0.20, landscaping: -0.10, roads: 0.00, lighting: 0.00, ecology: 0.00 },
};

const N = 50;
const GENDER_MALE_SHARE = 0.464; // доля мужчин по Саратовской области, 2024

// ---------------------------------------------------------------------------
// Квоты методом наибольших остатков — гарантирует точные пропорции при N=50
// ---------------------------------------------------------------------------
function quotas(weights, total) {
  const sum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const base = raw.map(Math.floor);
  let left = total - base.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < left; k++) base[order[k].i]++;
  return base;
}

const districtQuota = quotas(DISTRICTS.map((d) => d.pop), N);
const ageWeights = AGE_GROUPS.map((g) => g.share * g.bias);
const ageQuota = quotas(ageWeights, N);

// ---------------------------------------------------------------------------
// Совместное распределение «район × возраст» через IPF (итеративное
// пропорциональное подгонение). Даёт лёгкую реалистичную связь:
// окраины моложе, центр старше — при точном совпадении обеих маргиналий.
// ---------------------------------------------------------------------------
const D = DISTRICTS.length;
const A = AGE_GROUPS.length;

// стартовая матрица взаимодействий: спальные районы немного моложе
const INTERACTION = {
  'Волжский':    [0.7, 0.9, 1.0, 1.0, 1.0, 1.1, 1.3],
  'Заводской':   [1.2, 1.2, 1.2, 1.1, 1.0, 0.9, 0.8],
  'Кировский':   [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  'Ленинский':   [1.2, 1.1, 1.2, 1.1, 1.0, 0.9, 0.8],
  'Октябрьский': [0.8, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2],
  'Фрунзенский': [0.7, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2],
};

let M = DISTRICTS.map((d, i) =>
  AGE_GROUPS.map((g, j) => (districtQuota[i] * ageQuota[j]) / N * INTERACTION[d.name][j])
);

// IPF: 2 прохода по строкам и столбцам, заканчиваем масштабированием строк
for (let iter = 0; iter < 60; iter++) {
  for (let i = 0; i < D; i++) {
    const rowSum = M[i].reduce((s, v) => s + v, 0);
    if (rowSum > 0) M[i] = M[i].map((v) => (v * districtQuota[i]) / rowSum);
  }
  for (let j = 0; j < A; j++) {
    let colSum = 0;
    for (let i = 0; i < D; i++) colSum += M[i][j];
    if (colSum > 0) {
      for (let i = 0; i < D; i++) M[i][j] = (M[i][j] * ageQuota[j]) / colSum;
    }
  }
}

// Округляем матрицу до целых, сохраняя суммы строк и столбцов
const JOINT = M.map((row) => row.map(Math.floor));
for (let i = 0; i < D; i++) {
  let need = districtQuota[i] - JOINT[i].reduce((s, v) => s + v, 0);
  const order = M[i]
    .map((v, j) => ({ j, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (need > 0) { JOINT[i][order[k % A].j]++; need--; k++; }
}
// добираем по столбцам (не меняя суммы строк)
for (let j = 0; j < A; j++) {
  let cur = 0;
  for (let i = 0; i < D; i++) cur += JOINT[i][j];
  let need = ageQuota[j] - cur;
  while (need !== 0) {
    for (let i = 0; i < D && need !== 0; i++) {
      if (need > 0) { JOINT[i][j]++; need--; }
      else if (JOINT[i][j] > 0) { JOINT[i][j]--; need++; }
    }
  }
}

// ---------------------------------------------------------------------------
// Слоты выборки: (район, возрастная группа) по квотам
// ---------------------------------------------------------------------------
const slots = [];
for (let i = 0; i < D; i++) {
  for (let j = 0; j < A; j++) {
    for (let n = 0; n < JOINT[i][j]; n++) {
      slots.push({ district: DISTRICTS[i], group: AGE_GROUPS[j] });
    }
  }
}

// Пол: ровно по доле, независимо от района и возраста
const maleCount = Math.round(N * GENDER_MALE_SHARE);
const genders = [
  ...Array(maleCount).fill('Мужской'),
  ...Array(N - maleCount).fill('Женский'),
];
// перемешиваем (эффект «сквозного» распределения по слотам)
for (let i = genders.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [genders[i], genders[j]] = [genders[j], genders[i]];
}

// ---------------------------------------------------------------------------
// Генерация строк
// ---------------------------------------------------------------------------
const now = new Date('2026-11-16T19:00:00+04:00');

const rows = slots.map((slot, idx) => {
  const age = randInt(slot.group.min, slot.group.max);
  const gender = genders[idx];

  // «Строгость респондента»: одни люди ставят в среднем ниже, другие выше.
  // Сумма трёх равномерных ≈ нормальное; общий сдвиг на все темы сразу.
  const trait = (rand() + rand() + rand() - 1.5) * 0.9;

  const scores = {};
  for (const topic of TOPICS) {
    const target =
      BASE_MEAN[topic] +
      DISTRICT_ADJ[slot.district.name][topic] +
      AGE_ADJ[slot.group.key][topic];

    // собственное колебание оценки вокруг цели + общий сдвиг респондента
    const noise = (rand() + rand() + rand() - 1.5) * 0.85;
    let v = Math.round(target + trait + noise);

    // края шкалы: 5 ставят реже, чем 2 и 3 — типично для оценочных шкал
    if (rand() < 0.04) v = 5;
    if (rand() < 0.05) v = 1;

    scores[topic] = clamp(v, 1, 5);
  }

  // Дата: последние 30 дней, с поправкой на активность по дням недели
  const daysAgo = randInt(0, 29);
  const date = new Date(now.getTime() - daysAgo * 86400000);
  const dow = date.getDay(); // 0 — воскресенье
  // в выходные отвечают чаще днём, в будни — вечером
  const hour = dow === 0 || dow === 6 ? randInt(10, 22) : randInt(8, 22);
  date.setHours(hour, randInt(0, 59), randInt(0, 59), 0);

  return {
    gender,
    age,
    district: slot.district.name,
    transport:   scores.transport,
    roads:       scores.roads,
    landscaping: scores.landscaping,
    safety:      scores.safety,
    lighting:    scores.lighting,
    ecology:     scores.ecology,
    created_at:  date.toISOString(),
  };
});

// Сортируем по дате (старые → новые), как в реальной таблице
rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

const outDir = __dirname;

// ---------- SQL ----------
const esc = (s) => String(s).replace(/'/g, "''");
const sqlLines = [];
sqlLines.push('-- Тестовые данные для public.survey_responses — 50 записей');
sqlLines.push('-- Сгенерировано для проверки анкеты «Городская среда — Саратов»');
sqlLines.push('-- Пропорции по районам, полу и возрасту взяты из открытой статистики (см. generate-seed.js).');
sqlLines.push('-- Вставка идёт в public.survey_responses; id не задаётся (DEFAULT).');
sqlLines.push('-- Запускать в Supabase → SQL Editor.');
sqlLines.push('');
sqlLines.push('INSERT INTO public.survey_responses');
sqlLines.push('  (gender, age, district, transport, roads, landscaping, safety, lighting, ecology, created_at)');
sqlLines.push('VALUES');

const valueRows = rows.map((r) =>
  `  ('${esc(r.gender)}', ${r.age}, '${esc(r.district)}', ${r.transport}, ${r.roads}, ${r.landscaping}, ${r.safety}, ${r.lighting}, ${r.ecology}, '${r.created_at}')`
);
sqlLines.push(valueRows.join(',\n') + ';');
sqlLines.push('');
sqlLines.push('-- Проверка:');
sqlLines.push('-- SELECT count(*) FROM public.survey_responses;');

fs.writeFileSync(path.join(outDir, 'seed_survey_responses.sql'), sqlLines.join('\n'), 'utf8');

// ---------- CSV ----------
// Разделитель ; (Excel в русской локали), BOM для корректной кириллицы
const csvHeader = ['gender', 'age', 'district', 'transport', 'roads', 'landscaping', 'safety', 'lighting', 'ecology', 'created_at'];
const csvRows = rows.map((r) =>
  csvHeader.map((k) => {
    const s = String(r[k]);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')
);
fs.writeFileSync(
  path.join(outDir, 'survey_responses_50.csv'),
  '\ufeff' + [csvHeader.join(';'), ...csvRows].join('\r\n'),
  'utf8'
);

// ---------- JSON (для REST POST / для импорта) ----------
fs.writeFileSync(
  path.join(outDir, 'survey_responses_50.json'),
  JSON.stringify(rows, null, 2),
  'utf8'
);

// ---------- Сводка ----------
const byDistrict = {};
const byGender = { 'Мужской': 0, 'Женский': 0 };
const ageBuckets = {};
AGE_GROUPS.forEach((g) => (ageBuckets[g.key] = 0));
const sums = {};
TOPICS.forEach((t) => (sums[t] = 0));

rows.forEach((r) => {
  byDistrict[r.district] = (byDistrict[r.district] || 0) + 1;
  byGender[r.gender]++;
  TOPICS.forEach((t) => (sums[t] += r[t]));
  const g = AGE_GROUPS.find((x) => r.age >= x.min && r.age <= x.max);
  ageBuckets[g.key]++;
});

console.log('Сгенерировано записей:', rows.length);
console.log('\nПо районам (в скобках — доля населения по Росстату):');
Object.entries(byDistrict)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => {
    const pop = DISTRICTS.find((d) => d.name === k).pop;
    console.log(`  ${k}: ${v} (${((pop / POP_TOTAL) * 100).toFixed(1)}% населения)`);
  });
console.log('\nПо полу:', JSON.stringify(byGender));
console.log('\nПо возрасту:', JSON.stringify(ageBuckets));
console.log('\nСредние оценки:');
TOPICS.forEach((t) => console.log(`  ${t}: ${round1(sums[t] / rows.length)}`));
console.log('\nФайлы:');
console.log('  seed_survey_responses.sql');
console.log('  survey_responses_50.csv');
console.log('  survey_responses_50.json');
