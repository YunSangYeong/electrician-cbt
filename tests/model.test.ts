import { describe, expect, it } from "vitest";
import {
  answerExam,
  BASE_BANK,
  checkPractice,
  createExam,
  emptyStore,
  fingerprint,
  grade,
  importQuestions,
  nextPractice,
  parseCsv,
  remainingSeconds,
  restoreStore,
  startPractice,
  SUBJECTS,
  submitExam,
  validateQuestion,
  type Question,
} from "../src/model";
const bank = BASE_BANK;
describe("문제은행 품질", () => {
  it("90문항, 과목별 30개, 모두 출처가 표시된 자체 제작 내부 검수 문항", () => {
    expect(bank).toHaveLength(90);
    expect(new Set(bank.map((q) => q.id)).size).toBe(90);
    expect(new Set(bank.map(fingerprint)).size).toBe(90);
    SUBJECTS.forEach((s) =>
      expect(bank.filter((q) => q.subject === s)).toHaveLength(30),
    );
    bank.forEach((q) => {
      expect(() => validateQuestion(q)).not.toThrow();
      expect(q.type).toBe("original");
      expect(q.year).toBeNull();
      expect(q.session).toBeNull();
      expect(q.verificationStatus).toBe("reviewed");
      expect(q.explanation.length).toBeGreaterThan(30);
      expect(q.rights).toContain("자체 제작");
    });
  });
  for (const q of bank.filter((q) => q.calculation))
    it(`독립 계산 검증: ${q.id} ${q.topic}`, () => {
      const { kind, values: v, result, unit } = q.calculation!;
      // Independent evaluators from physics equations; not imported from the generation script.
      const calculations: Record<string, () => number> = {
        current: () => v[0] / v[1],
        series: () => v.reduce((a, b) => a + b, 0),
        parallel: () => 1 / v.reduce((a, b) => a + 1 / b, 0),
        power: () => v[0] * v[1],
        energy: () => v[0] * v[1],
        chargeMicro: () => v[0] * 1e-6 * v[1] * 1000,
        rms: () => v[0] / Math.sqrt(2),
        reciprocal: () => 1 / v[0],
        activePower: () => v[0] * v[1] * v[2],
        impedance: () => Math.hypot(v[0], v[1]),
        joule: () => v[0] ** 2 * v[1],
        capacitorEnergy: () => 0.5 * v[0] * v[1] ** 2,
        transformer: () => (v[0] / v[1]) * v[2],
        inputCurrent: () => (v[1] * v[2]) / v[0],
        efficiency: () => (v[1] / v[0]) * 100,
        backEmf: () => (v[0] - v[1]) / v[2],
        syncSpeed: () => (120 * v[0]) / v[1],
        slip: () => ((v[0] - v[1]) / v[0]) * 100,
      };
      expect(calculations[kind], `Unknown equation: ${kind}`).toBeDefined();
      expect(calculations[kind]()).toBeCloseTo(result, 8);
      expect(q.choices[q.answer - 1].replaceAll(" ", "")).toBe(
        `${result}${unit}`,
      );
      const equivalent = q.choices.filter((choice) => {
        const match = choice.match(/^([0-9.]+)(?:√([0-9.]+))?\s*(.+)$/);
        if (!match) throw new Error(`Unparsed numeric option: ${choice}`);
        let value =
          Number(match[1]) * (match[2] ? Math.sqrt(Number(match[2])) : 1);
        if (match[3] !== unit) {
          if (match[3] === "C" && unit === "mC") value *= 1000;
          else throw new Error(`Unexpected unit: ${match[3]}`);
        }
        return Math.abs(value - result) < 1e-8;
      });
      expect(equivalent).toHaveLength(1);
    });
});
describe("모의시험 및 절대 시간", () => {
  it("60개 고유 문항을 균형 있게 추출하며 검증 대기는 제외한다", () => {
    const exam = createExam(
      [...bank, { ...bank[0], id: "pending", verificationStatus: "pending" }],
      "2024-2026",
      1000,
    );
    expect(exam.questions).toHaveLength(60);
    expect(new Set(exam.questions.map((q) => q.id)).size).toBe(60);
    SUBJECTS.forEach((s) =>
      expect(exam.questions.filter((q) => q.subject === s)).toHaveLength(20),
    );
    expect(exam.deadline).toBe(3601000);
    expect(exam.questions.some((q) => q.id === "pending")).toBe(false);
  });
  it("미준비 버전과 과목 문항 부족은 시험 시작을 차단한다", () => {
    expect(() => createExam(bank, "2027-2029")).toThrow();
    expect(() =>
      createExam(
        bank.filter((q) => q.subject !== "전기이론"),
        "2024-2026",
      ),
    ).toThrow();
  });
  it("35개 정답은 불합격, 36개 정답은 60점 합격이며 과락이 없다", () => {
    const e = createExam(bank, "2024-2026");
    e.questions.slice(0, 35).forEach((q) => (e.answers[q.id] = q.answer));
    expect(grade(e).passed).toBe(false);
    expect(grade(e).score).toBe(58.3);
    e.answers[e.questions[35].id] = e.questions[35].answer;
    expect(grade(e)).toMatchObject({
      correct: 36,
      wrong: 24,
      unanswered: 24,
      score: 60,
      passed: true,
    });
    SUBJECTS.forEach((s) => {
      const sub = grade(e).subjects.find((x) => x.subject === s)!;
      expect(sub.total).toBe(20);
    });
  });
  it("답안 변경을 허용하고 종료 시각 이후 변경은 차단한다", () => {
    let state = { ...emptyStore(), exam: createExam(bank, "2024-2026", 1000) };
    const id = state.exam.questions[0].id;
    let s = answerExam(state, id, 1, 2000);
    s = answerExam(s, id, 2, 3000);
    expect(s.exam?.answers[id]).toBe(2);
    s = answerExam(s, id, 3, 3601000);
    expect(s.exam).toBeNull();
    expect(s.results[0].answers[id]).toBe(2);
    expect(s.results[0].reason).toBe("timeout");
  });
  it("새로고침 후 절대 시각으로 복원하고 백그라운드 지연을 더하지 않는다", () => {
    const s = { ...emptyStore(), exam: createExam(bank, "2024-2026", 1000) };
    const restored = restoreStore(JSON.stringify(s));
    expect(remainingSeconds(restored.exam!.deadline, 1000)).toBe(3600);
    expect(remainingSeconds(restored.exam!.deadline, 1801000)).toBe(1800);
    expect(remainingSeconds(restored.exam!.deadline, 3600999)).toBe(1);
    expect(remainingSeconds(restored.exam!.deadline, 3601000)).toBe(0);
    expect(remainingSeconds(restored.exam!.deadline, 9999999)).toBe(0);
  });
  it("제출은 한 번만 기록되고 미응답은 오답노트에 들어간다", () => {
    const s = { ...emptyStore(), exam: createExam(bank, "2024-2026", 1000) };
    const submitted = submitExam(s, 4000);
    expect(submitted.attempts).toHaveLength(60);
    expect(submitted.wrongIds).toHaveLength(60);
    expect(submitted.results).toHaveLength(1);
    expect(submitExam(submitted, 5000)).toEqual(submitted);
  });
});
describe("랜덤 학습", () => {
  it("한 과목의 모든 문항을 순회하기 전에는 중복이 없다", () => {
    let p = startPractice(bank, "2024-2026", "전기이론");
    const ids = new Set<string>();
    for (let i = 0; i < 30; i++) {
      expect(ids.has(p.currentId)).toBe(false);
      ids.add(p.currentId);
      p = nextPractice(p, bank);
    }
    expect(ids.size).toBe(30);
    expect(p.subject).toBe("전기이론");
  });
  it("즉시 채점·연속 정답·통계를 저장하며 중복 채점을 방지한다", () => {
    const p = startPractice(bank, "2024-2026");
    const q = bank.find((q) => q.id === p.currentId)!;
    const s = checkPractice(
      {
        ...emptyStore(),
        wrongIds: [q.id],
        practice: { ...p, selected: q.answer },
      },
      bank,
      1234,
    );
    expect(s.practice).toMatchObject({
      revealed: true,
      streak: 1,
      correct: 1,
      answered: 1,
    });
    expect(s.attempts).toHaveLength(1);
    expect(s.wrongIds).not.toContain(q.id);
    expect(checkPractice(s, bank, 3000)).toEqual(s);
    const next = nextPractice(s.practice!, bank);
    const q2 = bank.find((q) => q.id === next.currentId)!;
    const wrong = checkPractice(
      { ...s, practice: { ...next, selected: (q2.answer % 4) + 1 } },
      bank,
    );
    expect(wrong.practice?.streak).toBe(0);
    expect(wrong.wrongIds).toContain(q2.id);
  });
  it("오답만 선택한 복습에서는 해당 문항만 출제하며 1개 문제도 재학습할 수 있다", () => {
    const p = startPractice(bank, "2024-2026", "전체", [bank[0].id]);
    expect(p.currentId).toBe(bank[0].id);
    expect(nextPractice({ ...p, revealed: true }, bank)).toMatchObject({
      currentId: bank[0].id,
      revealed: false,
    });
  });
});
describe("가져오기 및 복구", () => {
  const example = {
    ...bank[0],
    id: "CUSTOM-001",
    question: "사용자가 작성한 고유한 질문",
  };
  it("JSON은 검증 대기로 등록하며 ID 및 보기 순서가 다른 동일 문항을 중복 제거한다", () => {
    expect(importQuestions([example], bank).added[0].verificationStatus).toBe(
      "pending",
    );
    expect(
      importQuestions(
        [
          bank[0],
          {
            ...bank[0],
            id: "OTHER",
            choices: [...bank[0].choices].reverse(),
            answer: 5 - bank[0].answer,
          },
        ],
        bank,
      ),
    ).toMatchObject({ added: [], duplicates: 2 });
  });
  it("CSV의 쉼표·줄바꿈·따옴표를 보존하며 JSON과 동등한 문항을 읽는다", () => {
    const q = { ...example, question: '쉼표, 따옴표 "테스트"\n다음 줄' };
    const { choices, ...rest } = q;
    const entries = {
      ...rest,
      choice1: choices[0],
      choice2: choices[1],
      choice3: choices[2],
      choice4: choices[3],
    };
    const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv =
      Object.keys(entries).join(",") +
      "\n" +
      Object.values(entries).map(escape).join(",");
    const parsed = parseCsv(csv);
    expect(importQuestions(parsed, bank).added[0].question).toBe(q.question);
  });
  it("가짜 연도, 잘못된 정답, 중복 보기, 위험한 출처 URL, 미완결 CSV는 차단한다", () => {
    for (const value of [
      { ...example, year: 2020 },
      { ...example, answer: 5 },
      { ...example, choices: ["a", "a", "b", "c"] },
      { ...example, sourceUrl: "javascript:alert(1)" },
      { ...example, sourceUrl: "https://example.com", session: "1" },
    ])
      expect(() => importQuestions([value], bank)).toThrow();
    expect(() => parseCsv('id,question\n"open')).toThrow();
    expect(() => parseCsv("id,id\nx,x")).toThrow();
    expect(() => parseCsv("id,question\none")).toThrow();
  });
  it("1개 오류라도 전체 등록을 중단한다", () => {
    expect(() =>
      importQuestions(
        [example, { ...example, id: "invalid", answer: 99 }],
        bank,
      ),
    ).toThrow("2번 문항");
  });
  it("존재하는 기록은 보존하고 손상된 저장소 형식은 거부한다", () => {
    expect(restoreStore(null)).toEqual(emptyStore());
    expect(restoreStore(JSON.stringify(emptyStore()))).toEqual(emptyStore());
    expect(() => restoreStore("{bad")).toThrow();
    expect(() =>
      restoreStore(
        JSON.stringify({ ...emptyStore(), exam: { questions: [] } }),
      ),
    ).toThrow();
    expect(() =>
      restoreStore(
        JSON.stringify({ ...emptyStore(), practice: { currentId: "invalid" } }),
      ),
    ).toThrow();
  });
});
