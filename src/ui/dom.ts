export type Child=Node|string|number|null|undefined|false;
export function el<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,unknown>={},...children:Child[]):HTMLElementTagNameMap[K]{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key.startsWith('on')&&typeof value==='function')node.addEventListener(key.slice(2).toLowerCase(),value as EventListener);else if(key==='class')node.className=String(value);else if(key==='text')node.textContent=String(value);else if(value!==false&&value!=null){if(key in node&&['value','checked','disabled','selected'].includes(key))(node as unknown as Record<string,unknown>)[key]=value;else node.setAttribute(key,value===true?'':String(value));}}for(const ch of children)if(ch!==null&&ch!==undefined&&ch!==false)node.append(ch instanceof Node?ch:document.createTextNode(String(ch)));return node;}
export const button=(text:string,fn:()=>void,attrs:Record<string,unknown>={})=>el('button',{type:'button',onclick:fn,...attrs},text);
export const lines=(texts:readonly string[])=>el('div',{class:'lines'},...texts.map(t=>el('p',{},t)));
export function field(label:string,value:string,onchange:(s:string)=>void,type='text'){const input=el('input',{type,value,'aria-label':label,maxlength:2000,onchange:(e:Event)=>onchange((e.target as HTMLInputElement).value)});return el('label',{class:'field'},el('span',{},label),input);}
export const checkbox=(label:string,checked:boolean,fn:()=>void)=>el('label',{class:'check'},el('input',{type:'checkbox',checked,onchange:fn}),label);
export const select=(label:string,items:{value:string;label:string}[],value:string,fn:(s:string)=>void)=>el('label',{class:'field'},el('span',{},label),el('select',{'aria-label':label,value,onchange:(e:Event)=>fn((e.target as HTMLSelectElement).value)},...items.map(x=>el('option',{value:x.value,selected:x.value===value},x.label))));
export function download(text:string,type:string,name:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/** null·false를 건너뛰고 붙인다(조건부 화면 조각용). */
export function add(parent: Element, ...children: Child[]) {
  for (const ch of children) if (ch !== null && ch !== undefined && ch !== false) parent.append(ch instanceof Node ? ch : String(ch));
  return parent;
}
