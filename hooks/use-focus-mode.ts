'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createFocusMode,type FocusMode} from '@/lib/focus-mode';

export function useFocusMode() {
  const [active,setActive]=useState(false);
  const session=useRef<FocusMode|null>(null);
  useEffect(()=>{
    const current=createFocusMode(document,setActive);
    session.current=current;
    return()=>{session.current=null;current.dispose();};
  },[]);
  const toggle=useCallback(()=>session.current?.toggle(),[]);
  return {active,toggle};
}
