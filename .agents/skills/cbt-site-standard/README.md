# 다른 자격증 CBT용 표준 스킬

현재 전기기능사 CBT의 최종 구현을 표준으로 재사용하는 **CBT 전용 스킬 v1.0.0**이다. 기존 `verified-web-project`가 개발 절차 중심이었다면 이 스킬은 화면·기능·키보드·저장·문제은행·검증·배포 인수 기준까지 정한다.

- 기준 앱 커밋: `b9a682ccff1b460334b78d5bfad9375b7ec4fbb6` (2026-10-19)
- 핵심 스킬: [SKILL.md](SKILL.md)
- 고정 기준: [references/reference-baseline.md](references/reference-baseline.md)
- 자격증 설정: [references/qualification-profile.template.json](references/qualification-profile.template.json)
- 검증 체크리스트: [references/acceptance-checklist.md](references/acceptance-checklist.md)
- AGENTS 연결: [references/AGENTS.template.md](references/AGENTS.template.md)
- 새 클라우드 프로젝트 요청: [references/new-project-prompt.md](references/new-project-prompt.md)

새 프로젝트에서는 이 폴더 전체를 `.agents/skills/cbt-site-standard/`에 복사하고 기존 AGENTS.md에 연결한다. 필요한 파일을 저장소에서 읽어 적용하는 방식이므로 로컬 다운로드나 계정 전체 스킬 등록이 필수는 아니다. 이 작업으로 계정 공통 스킬 설치나 새 클라우드 작업의 자동 인식을 검증한 것은 아니다.

표준은 학습 기준 드롭다운 없는 최종 화면, 두 모드 Space 이동, 타이머·복원·채점·해설·오답·북마크·통계·문제 관리·Pages 배포를 포함한다. 자격증별 규칙·문항은 따로 확인하며, 900개 전기 문제를 다른 분야에 그대로 복사하거나 900개 기출이 확보된 것처럼 표현하지 않는다. 스킬은 다른 자격증의 정답 정확성이나 자동으로 동일한 산출물이 만들어짐을 보증하지 않는다.

기준을 변경하면 이 스킬 버전과 기준 커밋·인수 명세를 함께 갱신한다. 원본 사이트의 과거 배포·테스트 결과는 새 프로젝트의 증거가 아니다.
