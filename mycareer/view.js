/**
 * 커리어 페이지의 화면 생성과 발표 이벤트를 담당합니다.
 *
 * 역할 구분
 * - app.js: JSON을 불러온 뒤 이 파일의 mountCareerPage()를 호출합니다.
 * - content.js: JSON 구조가 올바른지 확인합니다.
 * - view.js: 전달받은 콘텐츠를 DOM으로 만들고 클릭·키보드 이벤트를 연결합니다.
 *
 * 이 파일에는 발표 문구를 직접 저장하지 않습니다. 수정할 문구는
 * mycareer.content.json에서 관리하고, 여기서는 화면에 배치하는 방법만 정의합니다.
 */

/**
 * JSON 문구를 안전한 DOM 노드로 변환합니다.
 * - \n: <br> 줄바꿈으로 변환
 * - **문구**: 강조 색상을 가진 .hl 요소로 변환
 * - 그 외 문자열: textContent와 같은 일반 텍스트로 삽입
 *
 * innerHTML을 사용하지 않기 때문에 JSON에 HTML 태그가 들어가도 실행되지 않습니다.
 */
export function setText(node, value = '') {
  node.replaceChildren();
  String(value).split(/(\*\*[^*]+\*\*|\n)/g).forEach(part => {
    if (part === '\n') node.append(document.createElement('br'));
    else if (part.startsWith('**') && part.endsWith('**')) {
      const emphasis = document.createElement('span');
      emphasis.className = 'hl'; emphasis.textContent = part.slice(2, -2); node.append(emphasis);
    } else node.append(document.createTextNode(part));
  });
}

/** 태그·클래스·문구를 받아 반복되는 DOM 생성 코드를 줄이는 보조 함수입니다. */
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) setText(node, text);
  return node;
}

/** 같은 상세 패널을 다시 선택했을 때도 등장 애니메이션을 재실행합니다. */
function reanimate(node) { node.style.animation = 'none'; void node.offsetWidth; node.style.animation = ''; }

/**
 * Journey 연도, Strengths 사례, Growth 역량처럼
 * '여러 버튼 중 하나를 선택해 상세 내용을 교체하는 UI'를 공통 처리합니다.
 *
 * @param {Element} container 버튼을 넣을 부모 요소
 * @param {Array} items JSON에서 가져온 선택 항목
 * @param {Function} renderButton 버튼 내부를 만드는 함수
 * @param {Function} renderDetail 선택한 항목의 상세 화면을 만드는 함수
 * @param {number|null} initialIndex 처음부터 선택할 항목. null이면 클릭 전까지 미선택
 */
function selectable(container, items, renderButton, renderDetail, initialIndex = null) {
  // JSON 배열 개수만큼 버튼을 만들고 각 버튼에 자신의 인덱스를 연결합니다.
  const buttons = items.map((item, index) => {
    const button = make('button'); button.type = 'button'; renderButton(button, item, index);
    button.addEventListener('click', () => select(index)); return button;
  });
  container.replaceChildren(...buttons);

  // 활성 버튼의 시각 상태와 접근성 상태를 함께 갱신한 뒤 상세 내용을 그립니다.
  function select(index) {
    buttons.forEach((button, position) => {
      const active = position === index;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    renderDetail(items[index], index);
  }

  // Journey처럼 기본 선택이 필요한 영역만 전달받은 인덱스를 즉시 엽니다.
  if (Number.isInteger(initialIndex) && items[initialIndex]) select(initialIndex);
}

/**
 * 페이지 전체를 초기화하는 진입 함수입니다.
 * root에는 document, content에는 검증이 끝난 mycareer.content.json 데이터가 전달됩니다.
 */
export function mountCareerPage(root, content) {
  // 반복되는 querySelector 호출을 짧게 쓰기 위한 지역 보조 함수입니다.
  const $ = selector => root.querySelector(selector);

  // 브라우저 탭 제목과 검색 엔진용 설명을 JSON의 page 정보로 설정합니다.
  root.title = content.page.title; $('meta[name="description"]').content = content.page.description;

  // HTML의 data-text="growth.title" 같은 경로를 JSON에서 찾아 정적 문구를 채웁니다.
  root.querySelectorAll('[data-text]').forEach(node => {
    const value = node.dataset.text.split('.').reduce((result, key) => result?.[key], content);
    if (typeof value !== 'string') throw new Error(`문구를 찾지 못했습니다: ${node.dataset.text}`);
    setText(node, value);
  });

  /* --------------------------------------------------------------------------
   * HOME 영역
   * -------------------------------------------------------------------------- */
  // 쿼카 이미지의 대체 텍스트를 설정해 이미지를 볼 수 없는 사용자에게도 설명합니다.
  $('#quokkaImage').alt = content.home.imageAlt;

  // HOME의 세 말풍선 메뉴를 JSON 배열로 생성합니다.
  $('#homeMenu').replaceChildren(...content.home.menu.map(item => {
    const link = make('a'); link.href = `#${item.target}`;
    link.append(make('small', '', item.eyebrow), make('strong', '', item.title)); return link;
  }));

  /* --------------------------------------------------------------------------
   * 하위 영역 공통 내비게이션
   * -------------------------------------------------------------------------- */
  // HOME과 세 발표 영역의 링크를 한 목록에서 생성해 화면별 링크 불일치를 막습니다.
  const navigation = [{ target: 'home', label: 'HOME' }, ...content.home.menu.map(item => ({ target: item.target, label: item.eyebrow }))];
  root.querySelectorAll('.section-nav').forEach(nav => {
    const current = nav.closest('.slide').id;
    nav.replaceChildren(...navigation.map(item => {
      const link = make('a', item.target === current ? 'active' : '', item.label);
      link.href = `#${item.target}`;
      if (item.target === current) link.setAttribute('aria-current', 'page');
      return link;
    }));
  });

  /* --------------------------------------------------------------------------
   * JOURNEY 영역
   * -------------------------------------------------------------------------- */
  // 왼쪽에는 연도·산업 버튼, 오른쪽에는 프로젝트 경험과 깨달음을 표시합니다.
  // 마지막 인수 0 때문에 페이지 진입 시 2018—2020 항목이 기본으로 열립니다.
  selectable($('#journeyTabs'), content.journey.entries,
    (button, item) => button.append(make('b', '', item.period), make('span', '', item.industry)),
    item => {
      $('#journeyDetail').hidden = false; $('#journeyDetail').closest('.journey-layout').classList.remove('awaiting');
      // 한 연도에 여러 프로젝트가 있으면 각각 독립된 카드로 구분합니다.
      const heading = make('div', 'journey-detail-head');
      heading.append(make('p', 'detail-kicker', 'PROJECT EXPERIENCE'), make('h6', '', `${item.industry} · ${item.projects.length}개 프로젝트`));
      const projects = make('div', 'project-cards');
      projects.append(...item.projects.map(project => {
        const card = make('article', 'project-card');
        // 실제 기간을 그대로 flex 비율로 쓰면 단기 프로젝트가 너무 작아집니다.
        // log2를 적용해 장기 프로젝트는 더 크게, 단기 프로젝트도 읽을 수 있게 표현합니다.
        const visualWeight = project.durationMonths ? Math.max(1, Math.log2(project.durationMonths + 1)) : 1;
        card.style.setProperty('--duration-weight', visualWeight);

        // 참고 이미지의 왼쪽 영역: 프로젝트명, 기간, 구체적인 수행 내용
        const projectMain = make('div', 'project-main');
        const projectHead = make('header', 'project-card-head');
        projectHead.append(make('h4', '', project.title));
        if (project.duration) projectHead.append(make('span', '', project.duration));
        const tasks = make('ul', 'project-list');
        tasks.append(...project.tasks.map(task => make('li', '', task)));
        projectMain.append(projectHead, tasks);

        // 참고 이미지의 오른쪽 끝 영역: 프로젝트를 통해 얻은 경험과 깨달음
        const insight = make('aside', 'project-insight');
        insight.append(make('b', '', 'WHAT I LEARNED'), make('p', '', project.insight));
        card.append(projectMain, insight);
        return card;
      }));
      $('#journeyDetail').replaceChildren(heading, projects); reanimate($('#journeyDetail'));
    }, 0);

  /* --------------------------------------------------------------------------
   * STRENGTHS 영역
   * -------------------------------------------------------------------------- */
  // Journey에서 축적한 네 단계 문제 해결 방식을 상단 스트립으로 만듭니다.
  // $('#methodSteps').replaceChildren(...content.strengths.method.map((text, index) => {
  //   const step = make('div', 'method-step'); step.append(make('b', '', String(index + 1).padStart(2, '0')), document.createTextNode(text)); return step;
  // }));

  // 사례 버튼은 처음에는 제목만 보이고, 발표자가 클릭하면 네 단계 사례를 엽니다.
  selectable($('#caseTabs'), content.strengths.cases,
    (button, item) => button.append(make('small', '', item.number), make('b', '', item.title), make('span', '', item.project)),
    item => {
      $('#caseDetail').hidden = false; $('#caseDetail').closest('.strength-layout').classList.remove('awaiting');
      const head = make('header', 'case-title-row'); const title = make('div');
      title.append(make('p', 'detail-kicker', item.project), make('h3', '', item.title)); head.append(title, make('span', 'chip', item.chip));
      const steps = make('div', 'case-steps');
      steps.append(...item.steps.map((step, index) => { const card = make('div', 'case-step'); card.append(make('b', '', `${String(index + 1).padStart(2, '0')} ${step.title}`), make('p', '', step.description)); return card; }));
      $('#caseDetail').replaceChildren(head, steps); reanimate($('#caseDetail'));
    });

  /* --------------------------------------------------------------------------
   * GROWTH 영역 - AI 확장 영역과 사람의 판단
   * -------------------------------------------------------------------------- */
  // 역량 버튼을 클릭하면 AI가 도울 부분과 본인이 책임질 판단을 나란히 표시합니다.
  selectable($('#capabilityTabs'), content.growth.capabilities,
    (button, item) => setText(button, item.label),
    item => {
      $('#growthDetail').hidden = false;
      const ai = make('section', 'judgment-card'); ai.append(make('small', '', 'AI로 확장하는 영역'), make('h3', '', item.ai));
      const human = make('section', 'judgment-card human'); human.append(make('small', '', '내가 책임질 판단'), make('h3', '', item.human));
      $('#growthDetail').replaceChildren(ai, human); reanimate($('#growthDetail'));
    });

  // 기반 강점과 성장 우선순위가 공유하는 작은 카드 목록 생성 함수입니다.
  const fillList = (target, items, numbered = false) => {
    target.replaceChildren(...items.map((item, index) => {
      const node = make('article', 'mini-item');
      node.append(make('small', '', numbered ? String(index + 1).padStart(2, '0') : item.label), make('b', '', item.title), make('p', '', item.description)); return node;
    }));
  };
  fillList($('#foundationContent'), content.growth.foundations);
  fillList($('#priorityContent'), content.growth.priorities, true);

  /* --------------------------------------------------------------------------
   * GROWTH 영역 - 기반 강점 / 더 키울 역량 아코디언
   * -------------------------------------------------------------------------- */
  // 한 패널을 열면 다른 패널을 닫아 한 화면의 높이를 넘지 않도록 관리합니다.
  root.querySelectorAll('.accordion-panel').forEach(panel => {
    const trigger = panel.querySelector('.accordion-trigger'); const contentNode = panel.querySelector('.accordion-content'); const icon = trigger.querySelector('b');
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      root.querySelectorAll('.accordion-panel').forEach(other => { const otherTrigger = other.querySelector('.accordion-trigger'); otherTrigger.setAttribute('aria-expanded', 'false'); other.querySelector('.accordion-content').hidden = true; otherTrigger.querySelector('b').textContent = '＋'; });
      if (open) { trigger.setAttribute('aria-expanded', 'true'); contentNode.hidden = false; icon.textContent = '−'; }
    });
  });

  /* --------------------------------------------------------------------------
   * 발표 진행 보조 기능
   * -------------------------------------------------------------------------- */
  // 현재 스크롤 위치에 맞춰 화면 최상단의 보라색 진행 막대를 갱신합니다.
  const slides = [...root.querySelectorAll('.slide')]; const progress = $('#progress');
  const updateProgress = () => { const max = root.documentElement.scrollHeight - innerHeight; progress.style.width = `${max ? scrollY / max * 100 : 0}%`; };
  addEventListener('scroll', updateProgress, { passive: true }); updateProgress();

  // 버튼이나 링크에 포커스가 없을 때 Page Up/Down으로 이전·다음 슬라이드로 이동합니다.
  addEventListener('keydown', event => {
    if (!['PageDown','PageUp'].includes(event.key) || event.target.closest('button,a')) return;
    event.preventDefault(); const current = slides.reduce((best, slide, index) => Math.abs(slide.getBoundingClientRect().top) < Math.abs(slides[best].getBoundingClientRect().top) ? index : best, 0);
    slides[Math.max(0, Math.min(slides.length - 1, current + (event.key === 'PageDown' ? 1 : -1)))].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // 모든 초기화가 성공한 뒤에만 본문을 표시해 미완성 화면이 보이지 않게 합니다.
  $('main').hidden = false; $('#loadStatus').hidden = true;
}
