// 교실용 폴더 만들기: classroom/index.html + classroom/video/*.mp4 (docs/12 §4.1)
// dist/index.html은 단일 파일(≤5MB)이라 영상을 넣을 수 없어서, 영상은 옆 폴더로 둔다.
import {mkdirSync, copyFileSync, existsSync, statSync} from 'node:fs';
const out = 'classroom';
mkdirSync(`${out}/video`, {recursive: true});
copyFileSync('dist/index.html', `${out}/index.html`);
const videos = [
  ['output/seedance-remake/conservation-seedance-55s.mp4', 'conservation-seedance-55s.mp4'],
  ['output/seedance-remake/conservation-seedance-55s-plain.mp4', 'conservation-seedance-55s-plain.mp4'],
];
for (const [from, name] of videos) {
  if (existsSync(from)) {
    copyFileSync(from, `${out}/video/${name}`);
    console.log(`video/${name} ${(statSync(from).size / 1e6).toFixed(1)} MB`);
  } else console.warn(`없음(건너뜀): ${from}`);
}
console.log(`${out}/index.html을 USB나 교실 PC에 폴더째 복사해 여세요.`);
