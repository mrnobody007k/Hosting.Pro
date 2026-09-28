"use client";

import { useEffect, useMemo, useState } from "react";
import ManagerShell from "../ManagerShell";
import { Decimal } from "decimal.js";

type Order = {
  id:string; orderCode:string; amount:number; profit?:number; status:string; paymentStatus?:string; createdAt?:string;
  user?:{name:string;email:string}; property?:{title:string;location?:string|null};
};

function money(v:any){let n:Decimal;try{n=new Decimal(String(v??0))}catch{n=new Decimal(0)}if(!n.isFinite())n=new Decimal(0);const[i,f]=n.abs().toFixed(2).split(".");const g=i.length<=3?i:`${i.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,",")},${i.slice(-3)}`;return `${n.isNegative()?"-":""}₹${g}.${f}`}
function date(v?:string){return v?new Date(v).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}

export default function ManagerOrdersPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [manager,setManager]=useState("");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState("");

  async function load(){
    const [o,m]=await Promise.all([
      fetch("/api/manager/orders",{cache:"no-store"}),
      fetch("/api/manager/overview",{cache:"no-store"})
    ]);
    if(o.status===401){window.location.href="/manager-login";return}
    const oj=await o.json(), mj=await m.json();
    setOrders(Array.isArray(oj)?oj:oj.orders||[]);
    setManager(mj?.manager?.name||"Manager");
  }

  useEffect(()=>{load()},[]);

  async function act(id:string,action:"VERIFY_PAYMENT"|"CANCEL"){
    setBusy(id);
    await fetch("/api/manager/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id,action})});
    setBusy("");
    await load();
  }

  async function rerent(id:string){
    setBusy(id);
    await fetch("/api/manager/orders/rerent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id})});
    setBusy("");
    await load();
  }

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return orders.filter(o=>!q?[true]:[o.orderCode,o.user?.name,o.user?.email,o.property?.title,o.status].filter(Boolean).join(" ").toLowerCase().includes(q));
  },[orders,search]);

  return <ManagerShell managerName={manager}>
    <div className="mo-head"><div><span>ORDER OPERATIONS</span><h1>Client Orders</h1><p>Review payments, activate orders and manage re-rent tasks.</p></div><button onClick={load}>Refresh</button></div>
    <section className="mo-panel">
      <div className="mo-toolbar"><h2>Order Center</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, client, property..."/></div>
      <div className="mo-table"><table><thead><tr><th>Order</th><th>Client</th><th>Property</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>
      {filtered.map(o=><tr key={o.id}><td><strong>{o.orderCode}</strong></td><td>{o.user?.name}<small>{o.user?.email}</small></td><td>{o.property?.title}</td><td>{money(o.amount)}</td><td><b className={"mo-status "+o.status.toLowerCase()}>{o.status}</b></td><td>{date(o.createdAt)}</td><td><div className="mo-actions">
        {o.status==="PAYMENT_SUBMITTED"&&<button className="green" disabled={busy===o.id} onClick={()=>act(o.id,"VERIFY_PAYMENT")}>Verify</button>}
        {o.status==="ACTIVE"&&<button className="dark" disabled={busy===o.id} onClick={()=>rerent(o.id)}>Re-Rent</button>}
        {!["COMPLETED","CANCELLED","RE_RENTED"].includes(o.status)&&<button className="red" disabled={busy===o.id} onClick={()=>act(o.id,"CANCEL")}>Cancel</button>}
      </div></td></tr>)}</tbody></table>{!filtered.length&&<div className="mo-empty">No orders found.</div>}</div>
    </section>
    <style jsx global>{`
      .mo-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}.mo-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.mo-head h1{margin:5px 0;font-size:30px}.mo-head p{margin:0;color:#64748b;font-size:13px}.mo-head button{height:38px;border:0;border-radius:9px;background:#0f172a;color:white;padding:0 15px;font-weight:800}
      .mo-panel{background:white;border:1px solid #e5e7eb;border-radius:15px;padding:20px;box-shadow:0 5px 20px rgba(15,23,42,.04)}.mo-toolbar{display:flex;justify-content:space-between;gap:15px;margin-bottom:16px}.mo-toolbar h2{margin:0;font-size:18px}.mo-toolbar input{width:280px;height:38px;border:1px solid #dbe1ea;border-radius:9px;padding:0 11px}
      .mo-table{overflow:auto;border:1px solid #eef2f7;border-radius:11px}.mo-table table{width:100%;min-width:900px;border-collapse:collapse}.mo-table th{padding:11px;text-align:left;background:#f8fafc;color:#64748b;font-size:9px;text-transform:uppercase}.mo-table td{padding:12px;border-top:1px solid #eef2f7;font-size:11px;color:#334155}.mo-table td small{display:block;color:#64748b;margin-top:3px}.mo-actions{display:flex;gap:5px}.mo-actions button{border:0;border-radius:7px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.mo-actions .green{background:#dcfce7;color:#166534}.mo-actions .dark{background:#0f172a;color:white}.mo-actions .red{background:#fee2e2;color:#991b1b}.mo-status{font-size:9px;padding:5px 7px;border-radius:999px;background:#f1f5f9}.mo-status.active,.mo-status.completed,.mo-status.re_rented{background:#dcfce7;color:#166534}.mo-status.payment_submitted,.mo-status.payment_pending,.mo-status.re_rent_pending{background:#fef3c7;color:#92400e}.mo-status.cancelled{background:#fee2e2;color:#991b1b}.mo-empty{text-align:center;padding:40px;color:#64748b}@media(max-width:700px){.mo-head,.mo-toolbar{flex-direction:column}.mo-toolbar input{width:100%}}
    `}</style>
  </ManagerShell>
}
