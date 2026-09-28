"use client";

import { useEffect, useState } from "react";
import ManagerShell from "../ManagerShell";

type Order={id:string;orderCode:string;status:string;user?:{name:string;email:string};property?:{title:string}};
type Data={manager?:{name?:string}};

export default function ManagerTasksPage(){
 const [orders,setOrders]=useState<Order[]>([]);
 const [manager,setManager]=useState("");
 async function load(){
  const [o,m]=await Promise.all([fetch("/api/manager/orders",{cache:"no-store"}),fetch("/api/manager/overview",{cache:"no-store"})]);
  if(o.status===401){window.location.href="/manager-login";return}
  const oj=await o.json(),mj=await m.json();
  setOrders(Array.isArray(oj)?oj:oj.orders||[]);setManager(mj?.manager?.name||"Manager");
 }
 useEffect(()=>{load()},[]);
 return <ManagerShell managerName={manager}>
  <div className="mt-head"><span>TASK OPERATIONS</span><h1>Task Center</h1><p>Monitor active orders and the task workflow assigned to your clients.</p></div>
  <section className="mt-panel">
   <div className="mt-info"><strong>Task workflow</strong><span>Active orders can be moved into the re-rent workflow from the Order Center.</span></div>
   {orders.map(o=><div className="mt-row" key={o.id}><div><strong>{o.orderCode}</strong><small>{o.user?.name} · {o.property?.title}</small></div><b>{o.status}</b><a href="/manager/orders">Manage →</a></div>)}
   {!orders.length&&<div className="mt-empty">No order tasks currently available.</div>}
  </section>
  <style jsx global>{`
   .mt-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.mt-head h1{margin:5px 0;font-size:30px}.mt-head p{margin:0 0 20px;color:#64748b;font-size:13px}.mt-panel{background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:20px}.mt-info{display:flex;flex-direction:column;gap:4px;padding:15px;border-radius:11px;background:#f8fafc;margin-bottom:10px}.mt-info strong{font-size:12px}.mt-info span{font-size:11px;color:#64748b}.mt-row{display:flex;align-items:center;gap:15px;padding:15px 0;border-top:1px solid #eef2f7}.mt-row>div{flex:1}.mt-row strong,.mt-row small{display:block}.mt-row small{color:#64748b;font-size:10px;margin-top:3px}.mt-row b{font-size:9px;padding:5px 8px;border-radius:999px;background:#f1f5f9}.mt-row a{color:#2563eb;text-decoration:none;font-size:11px;font-weight:800}.mt-empty{text-align:center;padding:40px;color:#64748b}
  `}</style>
 </ManagerShell>
}
