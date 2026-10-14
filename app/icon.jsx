import {ImageResponse} from 'next/og';
export const size={width:512,height:512};
export const contentType='image/png';
export default function Icon(){
 return new ImageResponse(<div style={{width:512,height:512,background:'#141d27',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:92}}>
  <div style={{width:370,height:370,background:'#e78b52',color:'white',borderRadius:80,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:180,fontFamily:'sans-serif'}}>M.</div>
 </div>,size);
}
