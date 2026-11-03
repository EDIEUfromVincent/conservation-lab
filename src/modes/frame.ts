import spec from '../../frame-lab/4d-frame-spec.json' with {type:'json'};
import {mountFrameLab} from '../../frame-lab/frame-app.js';
import '../../frame-lab/frame-viewer.css';
import '../../frame-lab/frame-app.css';
export function mountFrame(root:HTMLElement){return mountFrameLab(root,spec);}
