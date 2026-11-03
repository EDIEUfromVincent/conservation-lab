import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
const csp="default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob: file:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'";
// VITE_EXTRAS=1 npm run build → 탐험·4D 프레임 심화 모드를 함께 번들한다(docs/12 §9).
const extras=process.env.VITE_EXTRAS==='1';
export default defineConfig({base:'./',define:{__EXTRAS__:JSON.stringify(extras)},plugins:[viteSingleFile(),{name:'offline-csp',apply:'build',transformIndexHtml(html){return html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);}}],build:{target:'es2020',modulePreload:false,assetsInlineLimit:1e8,cssCodeSplit:false}});
