/**
 * mycareer.content.json을 읽고 화면 렌더링 전에 데이터 구조를 검사합니다.
 *
 * 파일별 책임
 * - mycareer.content.json: 발표 문구와 반복 데이터
 * - content.js: JSON 로딩, 공통 문구 참조 해석, 데이터 검증
 * - view.js: 검증된 데이터로 화면 생성과 이벤트 연결
 * - app.js: content.js와 view.js 조립
 *
 * 이 모듈은 DOM을 직접 수정하지 않습니다.
 */

/** `a.b.c` 형태의 경로를 따라 객체 내부 값을 찾습니다. */
function getByPath(object, path) {
  return path.split('.').reduce((result, key) => result?.[key], object);
}

/**
 * `{ "$ref": "dictionary.method.problem" }` 형태의 공통 문구 참조를
 * dictionary에 저장된 실제 값으로 변환합니다.
 */
function resolveReferences(value, root, resolving = []) {
  const isReference =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof value.$ref === 'string';

  if (isReference) {
    const path = value.$ref;
    if (resolving.includes(path)) {
      throw new Error(`순환 참조를 사용할 수 없습니다: ${[...resolving, path].join(' → ')}`);
    }
    const referencedValue = getByPath(root, path);
    if (referencedValue === undefined) {
      throw new Error(`공통 문구 참조를 찾지 못했습니다: ${path}`);
    }
    // 참조 대상이 다른 참조일 수도 있으므로 실제 값이 나올 때까지 반복합니다.
    return resolveReferences(referencedValue, root, [...resolving, path]);
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveReferences(item, root, resolving));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveReferences(item, root, resolving)])
    );
  }
  return value;
}

/** 필수 문구가 비어 있지 않은 문자열인지 검사합니다. */
function requireText(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path}는 비어 있지 않은 문자열이어야 합니다.`);
  }
}

/** 버튼이나 카드용 데이터가 최소 한 항목을 가진 배열인지 검사합니다. */
function requireArray(value, path) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path}는 비어 있지 않은 배열이어야 합니다.`);
  }
}

/**
 * JSON을 불러오고 현재 화면이 요구하는 데이터 구조를 검사합니다.
 * 오류가 있으면 정확한 JSON 경로를 포함한 Error를 발생시킵니다.
 */
export async function loadContent(url) {
  // JSON 수정 후 새로고침하면 즉시 반영되도록 브라우저 캐시를 사용하지 않습니다.
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`콘텐츠를 불러오지 못했습니다 (HTTP ${response.status}).`);
  }

  // JSON 문법 오류는 response.json() 단계에서 발생해 app.js의 오류 화면으로 전달됩니다.
  const rawContent = await response.json();
  // view.js가 $ref를 몰라도 되도록 모든 참조를 먼저 실제 문구로 변환합니다.
  const content = resolveReferences(rawContent, rawContent);

  /* 페이지와 영역별 필수 문구 */
  [
    'page.title', 'page.description',
    'home.imageAlt', 'home.imageCaption',
    'journey.title', 'journey.description',
    'strengths.title', 'strengths.description', 'strengths.closing',
    'growth.title', 'growth.description',
    'growth.foundationTitle', 'growth.priorityTitle'
  ].forEach(path => requireText(getByPath(content, path), path));

  /* 반복 렌더링에 필요한 필수 배열 */
  [
    'home.menu', 'journey.entries',
    'strengths.method', 'strengths.cases',
    'growth.capabilities', 'growth.foundations', 'growth.priorities'
  ].forEach(path => requireArray(getByPath(content, path), path));

  /* HOME 말풍선 목차 */
  content.home.menu.forEach((item, index) => {
    const path = `home.menu[${index}]`;
    requireText(item.target, `${path}.target`);
    requireText(item.eyebrow, `${path}.eyebrow`);
    requireText(item.title, `${path}.title`);
  });

  /* JOURNEY 연도와 프로젝트 */
  content.journey.entries.forEach((entry, entryIndex) => {
    const path = `journey.entries[${entryIndex}]`;
    requireText(entry.period, `${path}.period`);
    requireText(entry.industry, `${path}.industry`);
    requireArray(entry.projects, `${path}.projects`);

    // 같은 연도에 여러 프로젝트를 둘 수 있으며 각 프로젝트는 독립 카드가 됩니다.
    entry.projects.forEach((project, projectIndex) => {
      const projectPath = `${path}.projects[${projectIndex}]`;
      requireText(project.title, `${projectPath}.title`);
      if (typeof project.duration !== 'string') {
        throw new Error(`${projectPath}.duration은 문자열이어야 합니다.`);
      }
      // 실제 개월 수는 카드 크기 계산에 사용합니다. 모르는 경우 null을 허용합니다.
      if (
        project.durationMonths !== null &&
        (typeof project.durationMonths !== 'number' || project.durationMonths <= 0)
      ) {
        throw new Error(`${projectPath}.durationMonths는 양수 또는 null이어야 합니다.`);
      }
      requireArray(project.tasks, `${projectPath}.tasks`);
      project.tasks.forEach((task, taskIndex) => {
        requireText(task, `${projectPath}.tasks[${taskIndex}]`);
      });
      requireText(project.insight, `${projectPath}.insight`);
    });
  });

  /* STRENGTHS의 네 가지 역량과 사례 */
  content.strengths.method.forEach((method, index) => {
    requireText(method, `strengths.method[${index}]`);
  });
  content.strengths.cases.forEach((item, index) => {
    const path = `strengths.cases[${index}]`;
    requireText(item.number, `${path}.number`);
    requireText(item.project, `${path}.project`);
    requireText(item.title, `${path}.title`);
    requireText(item.chip, `${path}.chip`);
    requireArray(item.steps, `${path}.steps`);
    item.steps.forEach((step, stepIndex) => {
      requireText(step.title, `${path}.steps[${stepIndex}].title`);
      requireText(step.description, `${path}.steps[${stepIndex}].description`);
    });
  });

  /* GROWTH의 AI 활용 영역과 사람의 판단 */
  content.growth.capabilities.forEach((item, index) => {
    const path = `growth.capabilities[${index}]`;
    requireText(item.label, `${path}.label`);
    requireText(item.ai, `${path}.ai`);
    requireText(item.human, `${path}.human`);
  });

  /* GROWTH의 기반 강점과 성장 우선순위 */
  content.growth.foundations.forEach((item, index) => {
    const path = `growth.foundations[${index}]`;
    requireText(item.label, `${path}.label`);
    requireText(item.title, `${path}.title`);
    requireText(item.description, `${path}.description`);
  });
  content.growth.priorities.forEach((item, index) => {
    const path = `growth.priorities[${index}]`;
    requireText(item.title, `${path}.title`);
    requireText(item.description, `${path}.description`);
  });

  return content;
}
