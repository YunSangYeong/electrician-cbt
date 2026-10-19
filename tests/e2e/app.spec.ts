import { expect, test, type Page } from "@playwright/test";
import bank from "../../src/data/questions-2024-2026.json" with { type: "json" };
const key = "electrician-cbt:v1";
async function nav(page: Page, label: string) {
  if (await page.getByRole("button", { name: "메뉴 열기" }).isVisible())
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function read(page: Page) {
  return await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
test("대시보드·모바일 레이아웃·준비 중 버전", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "전기기능사 필기 CBT", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "모의시험 시작하기", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".bank-summary")).toContainText(/등록\s*900문항/);
  await page.getByLabel("학습 기준").selectOption("2027-2029");
  await expect(
    page.getByRole("button", { name: "모의시험 시작하기", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("학습 기준")).toHaveValue("2027-2029");
  expect(errors).toEqual([]);
});
test("60문항 답변·북마크·새로고침 복원·합격 결과·전체 해설·오답 복습", async ({
  page,
}) => {
  await page.goto("");
  await page
    .getByRole("button", { name: "모의시험 시작하기", exact: true })
    .click();
  await expect(page.getByLabel("남은 시간")).toContainText(/60:00|59:5[0-9]/);
  await expect(page.locator(".number-grid button")).toHaveCount(60);
  await expect(page.locator(".explanation")).toHaveCount(0);
  const original = await read(page);
  const questions = original.exam.questions;
  await page.getByRole("button", { name: "북마크 추가" }).click();
  for (let i = 0; i < 36; i++) {
    await page
      .getByRole("group", { name: "답안 선택" })
      .getByRole("button")
      .nth(questions[i].answer - 1)
      .click();
    if (i < 35)
      await page
        .getByRole("button", { name: "다음 문제", exact: true })
        .click();
  }
  const before = await read(page);
  expect(Object.keys(before.exam.answers)).toHaveLength(36);
  await page.reload();
  const after = await read(page);
  expect(after.exam.deadline).toBe(before.exam.deadline);
  expect(after.exam.answers).toEqual(before.exam.answers);
  await expect(page.getByRole("button", { name: "북마크 해제" })).toBeVisible();
  await page.getByRole("button", { name: "시험 종료 및 제출" }).click();
  await expect(page.getByRole("dialog")).toContainText("24개");
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "시험 종료 및 제출" }).click();
  await page.getByRole("button", { name: "제출하고 결과 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "모의시험 결과", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result-score")).toContainText("60");
  await expect(page.locator(".result-hero>.tag")).toHaveText("합격");
  await expect(page.locator(".review-card")).toHaveCount(60);
  await page.getByLabel("오답만 보기").check();
  await expect(page.locator(".review-card")).toHaveCount(24);
  const saved = await read(page);
  expect(saved.results).toHaveLength(1);
  expect(saved.attempts).toHaveLength(60);
  expect(saved.wrongIds).toHaveLength(24);
  await page.getByRole("button", { name: "이 시험 오답만 다시 풀기" }).click();
  expect((await read(page)).practice.poolIds).toHaveLength(24);
  await expect(page.locator(".question-stem")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("60분 뒤 자동 제출 및 중복 제출 방지", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-18T00:00:00Z") });
  await page.goto("");
  await page
    .getByRole("button", { name: "모의시험 시작하기", exact: true })
    .click();
  await page.clock.fastForward(3599000);
  await expect(page.getByLabel("남은 시간")).toContainText("00:01");
  await page.clock.fastForward(2000);
  await expect(
    page.getByRole("heading", { name: "모의시험 결과", exact: true }),
  ).toBeVisible();
  expect((await read(page)).results[0].reason).toBe("timeout");
  await page.reload();
  expect((await read(page)).results).toHaveLength(1);
});
test("즉시 채점·오답노트·연속 정답·학습 이어하기·북마크", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "문제풀이 시작하기" }).click();
  let s = await read(page);
  let q = bank.find((q) => q.id === s.practice.currentId)!;
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .nth(q.answer % 4)
    .click();
  await expect(page.getByRole("status")).toContainText("아쉬워요");
  await expect(page.locator(".explanation")).toBeVisible();
  await page.getByRole("button", { name: "북마크 추가" }).click();
  await page.reload();
  s = await read(page);
  expect(s.practice.answered).toBe(1);
  expect(s.wrongIds).toContain(q.id);
  await nav(page, "랜덤 문제풀이");
  await expect(page.locator(".explanation")).toBeVisible();
  await page.getByRole("button", { name: "다음 문제", exact: true }).click();
  s = await read(page);
  q = bank.find((q) => q.id === s.practice.currentId)!;
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .nth(q.answer - 1)
    .click();
  expect((await read(page)).practice.streak).toBe(1);
  expect((await read(page)).attempts).toHaveLength(2);
  await nav(page, "오답노트");
  await expect(page.locator(".review-card")).toHaveCount(1);
  await page.getByRole("button", { name: "1문제 다시 풀기" }).click();
  s = await read(page);
  q = bank.find((q) => q.id === s.practice.currentId)!;
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .nth(q.answer - 1)
    .click();
  expect((await read(page)).wrongIds).toHaveLength(0);
  await nav(page, "북마크");
  await expect(page.locator(".review-card")).toHaveCount(1);
  await nav(page, "학습 통계");
  await expect(page.locator(".subject-stat")).toHaveCount(3);
});
test("JSON 등록·중복 제거·검수 대기·사용자 검수·CSV 등록·초기화", async ({
  page,
}) => {
  await page.goto("");
  await nav(page, "문제은행 관리");
  await expect(page.locator(".bank-row")).toHaveCount(20);
  await expect(page.locator(".pagination")).toContainText("1 / 45");
  await page.getByLabel("문항 검색", { exact: true }).fill("ORG-I-300");
  await expect(page.locator(".bank-row")).toHaveCount(1);
  await page.locator(".bank-row summary").click();
  await expect(page.locator(".bank-row .explanation")).toContainText("5 A");
  await expect(page.locator(".bank-row .explanation")).toContainText(
    "자체 제작 계산 변형",
  );
  await page.getByLabel("문항 검색", { exact: true }).fill("");
  const custom = {
    ...bank[0],
    id: "LOCAL-001",
    question: "사용자가 만든 검수용 독립 문항",
    verificationStatus: "pending",
    reviewNote: "직접 작성함",
  };
  await page.getByLabel("문제 파일 가져오기").setInputFiles({
    name: "bank.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([custom, bank[0]])),
  });
  await expect(page.getByRole("status")).toContainText("1문항");
  expect((await read(page)).imported).toHaveLength(1);
  await page.getByLabel("검증 상태", { exact: true }).selectOption("pending");
  await page.locator(".bank-row summary").click();
  await page.getByRole("button", { name: "검수 내용 확인 및 승인" }).click();
  await expect(
    page.getByRole("button", { name: "검수 완료로 처리" }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "출처 원문, 이용 권한, 정답·풀이, 출제 연도·회차(해당 시)를 직접 확인했습니다.",
    )
    .check();
  await page.getByLabel("검수 근거").fill("자체 작성 및 옴의 법칙 대입 확인");
  await page.getByRole("button", { name: "검수 완료로 처리" }).click();
  expect((await read(page)).imported[0].verificationStatus).toBe("reviewed");
  const csv = await (await page.request.get("templates/questions.csv")).text();
  await page.getByLabel("문제 파일 가져오기").setInputFiles({
    name: "questions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect.poll(async () => (await read(page)).imported.length).toBe(2);
  await page.getByLabel("문제 파일 가져오기").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("[{}]"),
  });
  await expect(page.getByRole("alert")).toContainText("1번 문항");
  await expect.poll(async () => (await read(page)).imported.length).toBe(2);
  if (await page.getByRole("button", { name: "메뉴 열기" }).isVisible())
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("button", { name: "데이터 초기화", exact: true })
    .click();
  await page.getByRole("button", { name: "모든 데이터 초기화" }).click();
  expect((await read(page)).imported).toHaveLength(0);
});
test("만료된 시험 재접속은 즉시 제출하고 저장소 손상 시 원본을 보존한다", async ({
  page,
}) => {
  await page.goto("");
  await page
    .getByRole("button", { name: "모의시험 시작하기", exact: true })
    .click();
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.exam.startedAt = Date.now() - 3601000;
    s.exam.deadline = s.exam.startedAt + 3600000;
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "모의시험 결과", exact: true }),
  ).toBeVisible();
  await page.evaluate((k) => localStorage.setItem(k, "{broken"), key);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "기존 데이터를 덮어쓰지 않고",
  );
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "{broken",
  );
});

test("타이머 콜백 전 만료 후 답안 클릭도 자동 제출하며 답안을 반영하지 않는다", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-18T00:00:00Z") });
  await page.goto("");
  await page
    .getByRole("button", { name: "모의시험 시작하기", exact: true })
    .click();
  await page.clock.setSystemTime(new Date("2026-10-18T01:00:01Z"));
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "모의시험 결과", exact: true }),
  ).toBeVisible();
  const saved = await read(page);
  expect(saved.results).toHaveLength(1);
  expect(saved.results[0].answers).toEqual({});
  expect(saved.results[0].reason).toBe("timeout");
});

test("채점 후 Space로 한 문제씩 이동하고 버튼·컨트롤·대화상자 동작을 보존한다", async ({
  page,
}) => {
  await page.goto("");
  await page.getByRole("button", { name: "문제풀이 시작하기" }).click();
  const firstId = (await read(page)).practice.currentId;
  // Space does not skip an unanswered question.
  await page.keyboard.press("Space");
  expect((await read(page)).practice.currentId).toBe(firstId);
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.locator(".explanation")).toBeVisible();
  await expect(page.locator(".question-stem")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator(".explanation")).toHaveCount(0);
  let saved = await read(page);
  expect(saved.practice.currentId).not.toBe(firstId);
  expect(saved.practice.seen).toHaveLength(1);
  expect(saved.attempts).toHaveLength(1);
  const secondId = saved.practice.currentId;
  await page.keyboard.press("Space");
  expect((await read(page)).practice.currentId).toBe(secondId);

  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .first()
    .click();
  // Holding the key must not auto-advance.
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        repeat: true,
        bubbles: true,
      }),
    ),
  );
  expect((await read(page)).practice.currentId).toBe(secondId);
  // A focused bookmark button keeps native Space activation.
  await page.getByRole("button", { name: "북마크 추가" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "북마크 해제" })).toBeVisible();
  expect((await read(page)).practice.currentId).toBe(secondId);
  // A focused next button advances once, via its native click on keyup.
  await page.getByRole("button", { name: "다음 문제", exact: true }).focus();
  await page.keyboard.press("Space");
  saved = await read(page);
  expect(saved.practice.currentId).not.toBe(secondId);
  expect(saved.practice.seen).toHaveLength(2);
  expect(saved.attempts).toHaveLength(2);

  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .first()
    .click();
  const thirdId = (await read(page)).practice.currentId;
  // Space while a form control is focused keeps its default behavior.
  await page.locator("#practice-filter").focus();
  expect(
    await page.locator("#practice-filter").evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          bubbles: true,
          cancelable: true,
        }),
      ),
    ),
  ).toBe(true);
  expect((await read(page)).practice.currentId).toBe(thirdId);
  if (await page.getByRole("button", { name: "메뉴 열기" }).isVisible())
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("button", { name: "데이터 초기화", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Even a key event outside the dialog must not advance the background quiz.
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect((await read(page)).practice.currentId).toBe(thirdId);
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
});

test("실전시험에서도 답안 선택 후 Space로 이동하며 미응답·마지막 문제는 유지한다", async ({
  page,
}) => {
  await page.goto("");
  await page
    .getByRole("button", { name: "모의시험 시작하기", exact: true })
    .click();
  await page.keyboard.press("Space");
  await expect(page.locator(".question-counter strong")).toHaveText("01");
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.locator(".question-stem")).toBeFocused();
  await page.keyboard.press("Shift+Space");
  await expect(page.locator(".question-counter strong")).toHaveText("01");
  await page.keyboard.press("Space");
  await expect(page.locator(".question-counter strong")).toHaveText("02");
  await page.keyboard.press("Space");
  await expect(page.locator(".question-counter strong")).toHaveText("02");
  await page.getByRole("button", { name: "60번 미응답", exact: true }).click();
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .first()
    .click();
  await page.keyboard.press("Space");
  await expect(page.locator(".question-counter strong")).toHaveText("60");
  expect((await read(page)).exam).not.toBeNull();
  expect((await read(page)).results).toHaveLength(0);
  // Native keyboard selection of another choice remains available.
  await page
    .getByRole("group", { name: "답안 선택" })
    .getByRole("button")
    .nth(1)
    .focus();
  await page.keyboard.press("Space");
  const saved = await read(page);
  expect(saved.exam.answers[saved.exam.questions[59].id]).toBe(2);
});
