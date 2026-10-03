import {deflateSync} from 'node:zlib';
function crc32(bytes) {
 let crc = 0xffffffff;
 for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc>>>1)^((crc&1)?0xedb88320:0); }
 return (crc^0xffffffff)>>>0;
}
function chunk(name, bytes) {
 const type=Buffer.from(name), length=Buffer.alloc(4), crc=Buffer.alloc(4);
 length.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([type,bytes])));
 return Buffer.concat([length,type,bytes,crc]);
}
export function safePicture() {
 const size=256, header=Buffer.alloc(13); header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8]=8; header[9]=2;
 const pixels=Buffer.alloc(size*(1+size*3));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=y*(1+size*3)+1+x*3; pixels[p]=60;pixels[p+1]=125;pixels[p+2]=180;}
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
