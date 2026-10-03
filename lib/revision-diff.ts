export type DiffParagraph={text:string;kind:'same'|'added'|'removed'};
// Bounded paragraph LCS: at most one million cells. Manuscripts with unusually
// many paragraphs fall back to a safe full replacement instead of freezing UI.
export function revisionDiff(left:string,right:string):DiffParagraph[]{
 const a=left.split(/\n\s*\n/),b=right.split(/\n\s*\n/);
 if(a.length*b.length>1000000)return [...a.map(text=>({text,kind:'removed' as const})),...b.map(text=>({text,kind:'added' as const}))];
 const width=b.length+1,table=new Uint16Array((a.length+1)*width);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i*width+j]=a[i]===b[j]?1+table[(i+1)*width+j+1]:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
 const result:DiffParagraph[]=[];let i=0,j=0;
 while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){result.push({text:a[i++],kind:'same'});j++;}else if(j<b.length&&(i===a.length||table[i*width+j+1]>=table[(i+1)*width+j]))result.push({text:b[j++],kind:'added'});else result.push({text:a[i++],kind:'removed'});}
 return result;
}
