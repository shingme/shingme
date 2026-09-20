/** 앱 조립 지점: JSON 경로와 두 모듈의 연결은 이 파일 한 곳에서 관리합니다. */
import { loadContent } from './content.js?v=20260920-10';
import { mountCareerPage } from './view.js?v=20260920-10';
try {
  const content = await loadContent(new URL('../mycareer.content.json', import.meta.url));
  mountCareerPage(document, content);
} catch (error) {
  console.error(error);
  const status = document.getElementById('loadStatus');
  status.setAttribute('role', 'alert');
  status.textContent = `페이지를 표시하지 못했습니다: ${error.message}`;
}
