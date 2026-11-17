"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { readPageHeaders } from "@/lib/pagination";

export function usePagedResource(url,{enabled=true,identity,refresh=0,onPageChange}={}) {
  const [revision,setRevision]=useState(0);
  const previousIdentity=useRef(identity);
  const [state,setState]=useState({items:[],pagination:{page:1,pageSize:20,total:0,totalPages:1},statusCounts:{},listingTotal:0,activeTotal:0,loading:true,loaded:false,error:""});
  const reload=useCallback(()=>setRevision(value=>value+1),[]);
  const setItems=useCallback(value=>setState(old=>({...old,items:typeof value==="function"?value(old.items):value})),[]);
  useEffect(()=>{
    if(!enabled)return;
    let active=true,timedOut=false;const controller=new AbortController();
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},20000);
    const switched=previousIdentity.current!==identity;previousIdentity.current=identity;
    setState(old=>({...old,...(switched?{items:[],loaded:false,statusCounts:{},listingTotal:0,activeTotal:0}:{}),loading:true,error:""}));
    fetch(url,{cache:"no-store",signal:controller.signal}).then(async response=>{
      const items=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(items?.error||"Unable to load this page. Please retry."),{status:response.status});
      if(!Array.isArray(items))throw new Error("Unable to read this page.");
      const pagination=readPageHeaders(response);
      if(!active)return;
      if(pagination.page>pagination.totalPages&&onPageChange){onPageChange(pagination.totalPages);return;}
      let statusCounts={};try{statusCounts=JSON.parse(response.headers.get("x-status-counts")||"{}");}catch{}
      setState({items,pagination,statusCounts,listingTotal:Number(response.headers.get("x-total-listings"))||0,activeTotal:Number(response.headers.get("x-active-listings"))||0,loading:false,loaded:true,error:""});
    }).catch(error=>{if(active&&(error.name!=="AbortError"||timedOut))setState(old=>({...old,...([401,403].includes(error.status)?{items:[],statusCounts:{}}:{}),loading:false,loaded:true,error:timedOut?"This request timed out. Please retry.":error.message}));}).finally(()=>clearTimeout(timeout));
    return()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[url,enabled,identity,refresh,revision,onPageChange]);
  return {...state,...(!enabled?{items:[],statusCounts:{},loading:true,loaded:false}:{}),setItems,reload};
}
