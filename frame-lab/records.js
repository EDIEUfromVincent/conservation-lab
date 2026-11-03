export function validFrameRecord(value,spec){
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['version','fields','step'].includes(k))||value.version!==1||!Number.isInteger(value.step)||value.step<0||value.step>=spec.builds[0].steps.length||!value.fields||Array.isArray(value.fields)||typeof value.fields!=='object')return false;
 return Object.entries(value.fields).every(([key,v])=>{if(typeof v!=='string'||v.length>4000)return false;
 if(/^(M[12](prediction|observation|explain|limits)|design|revision)$/.test(key))return true;
 if(/^M[12]locked$/.test(key))return v==='yes'&&!!value.fields[key.slice(0,2)+'prediction']?.trim();
 if(key==='m2rows')return /^\d+$/.test(v)&&Number(v)>=1&&Number(v)<=20;
 if(/^m1-(0|2|4|6)-[1-3]$/.test(key))return !v||!!value.fields.M1locked&&numeric(v,0,10,.5);
 const m=key.match(/^m2-(face|count|shift|touch|damage|restore)-(\d+)(?:-([12]))?$/);if(!m||Number(m[2])<1||Number(m[2])>20)return false;
 if(!v)return true;if(!value.fields.M2locked)return false;
 return m[1]==='count'?numeric(v,0,6,1):m[1]==='shift'?numeric(v,0,10,.5):m[1]==='touch'?numeric(v,0,18,1):true;});
}
const numeric=(s,min,max,step)=>Number.isFinite(Number(s))&&Number(s)>=min&&Number(s)<=max&&Math.abs(Number(s)/step-Math.round(Number(s)/step))<1e-8;
export function frameCSV(state){const cell=v=>'"'+(/^[=+\-@\t\r]/.test(String(v))?"'":'')+String(v).replaceAll('"','""')+'"';return '\uFEFFfield,value\r\n'+Object.entries(state.fields).map(row=>row.map(cell).join(',')).join('\r\n');}
