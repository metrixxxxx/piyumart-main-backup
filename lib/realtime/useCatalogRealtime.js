"use client";
import { useEffect,useRef } from "react";
import { supabase } from "@/lib/supabase";

export function useCatalogRealtime(onChange) {
  const callback=useRef(onChange);
  useEffect(()=>{callback.current=onChange;},[onChange]);
  useEffect(()=>{
    let timer,active=true;
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(active)callback.current();},150);};
    const channel=supabase.channel("marketplace:catalog").on("broadcast",{event:"catalog:changed"},refresh).subscribe(status=>{if(status==="SUBSCRIBED")refresh();});
    const resume=()=>{if(document.visibilityState==="visible")refresh();};
    document.addEventListener("visibilitychange",resume);
    return()=>{active=false;clearTimeout(timer);document.removeEventListener("visibilitychange",resume);supabase.removeChannel(channel);};
  },[]);
}
