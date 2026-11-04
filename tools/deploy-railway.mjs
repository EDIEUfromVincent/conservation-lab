// Railway 배포: classroom 빌드(index.html + video/)를 deploy/railway/public에 모아 올린다.
// 영상 원본(output/seedance-remake/*.mp4)은 저장소에 없으므로 이 컴퓨터에 있어야 한다.
// 사용: npm run deploy:railway  (railway CLI 로그인 필요)
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const RAILWAY = {project: 'c2760df8-410c-4159-a872-071f8a9f4ff9', service: 'conservation-lab', environment: 'production'};
const URL = 'https://conservation-lab-production.up.railway.app';
const dir = 'deploy/railway';
const video = 'classroom/video/conservation-seedance-55s.mp4';

execFileSync('npm', ['run', 'package:classroom'], {stdio: 'inherit'});
if (!existsSync(video)) {
  console.error(`영상이 없어요: ${video}\noutput/seedance-remake/conservation-seedance-55s.mp4를 이 컴퓨터에 두고 다시 실행하세요.`);
  process.exit(1);
}

// 올릴 것만 모은다: 앱 파일과 영상(옛 인쇄 PDF·.DS_Store 같은 것은 빼고)
rmSync(`${dir}/public`, {recursive: true, force: true});
mkdirSync(`${dir}/public/video`, {recursive: true});
cpSync('classroom/index.html', `${dir}/public/index.html`);
cpSync(video, `${dir}/public/video/conservation-seedance-55s.mp4`);

// public/은 git에서 빼 두었으므로 --no-gitignore로 함께 올린다
execFileSync('railway', ['up', dir, '--path-as-root', '--no-gitignore', '--project', RAILWAY.project, '--service', RAILWAY.service,
  '--environment', RAILWAY.environment, '--detach', '-y'], {stdio: 'inherit'});
console.log(`올렸어요. 몇 분 뒤 ${URL} 에서 확인하세요.`);
