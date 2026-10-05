"use client";

import { useEffect, useMemo, useState } from "react";
import ManagerShell from "../ManagerShell";
import { Decimal } from "decimal.js";

type Order = {
  id:string; orderCode:string; amount:number|string; profit?:number|string; finalReturnAmount?:number|string|null; storehousePrice?:number|string; status:string; paymentStatus?:string; paymentReference?:string|null; paymentProofUrl?:string|null; createdAt?:string;
  user?:{name:string;email:string}; property?:{title:string;location?:string|null};
};

function money(v:any){let n:Decimal;try{n=new Decimal(String(v??0))}catch{n=new Decimal(0)}if(!n.isFinite())n=new Decimal(0);const[i,f]=n.abs().toFixed(2).split(".");const g=i.length<=3?i:`${i.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,",")},${i.slice(-3)}`;return `${n.isNegative()?"-":""}₹${g}.${f}`}
function date(v?:string){return v?new Date(v).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}

export default function ManagerOrdersPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [manager,setManager]=useState("");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState("");
  const [actionError,setActionError]=useState("");
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  const [loading,setLoading]=useState(true);

  async function load(append=false){
    if(append)setLoadingMore(true);else setLoading(true);
    try {
      const params=new URLSearchParams({q:search.trim()});
      if(append&&nextCursor)params.set("cursor",nextCursor);
      const o=await fetch(`/api/manager/orders?${params}`,{cache:"no-store"});
      if(o.status===401){window.location.href="/manager-login";return}
      const oj=await o.json();
      if(!o.ok)throw new Error(oj.error||"Unable to load orders.");
      const page=oj.orders||[];
      setOrders(current=>append?[...current,...page]:page);
      setNextCursor(oj.nextCursor||null);
      setManager(oj.manager?.name||"Manager");
    } catch(cause) {setActionError(cause instanceof Error?cause.message:"Unable to load orders.")}
    finally {setLoading(false);setLoadingMore(false)}
  }

  useEffect(()=>{const timer=window.setTimeout(()=>{setNextCursor(null);void load(false)},250);return()=>window.clearTimeout(timer)},[search]);

  async function act(id:string,action:"VERIFY_PAYMENT"|"REJECT_PAYMENT"|"CANCEL"){
    setBusy(id);
    setActionError("");
    try {
      const response=await fetch("/api/manager/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id,action})});
      const result=await response.json();
      if(!response.ok) throw new Error(result?.error||"Unable to update this order.");
      await load();
    } catch(error) {
      setActionError(error instanceof Error?error.message:"Unable to update this order.");
    } finally { setBusy(""); }
  }

  async function rerent(id:string){
    setBusy(id);
    setActionError("");
    try {
      const response=await fetch("/api/manager/orders/rerent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id})});
      const result=await response.json();
      if(!response.ok) throw new Error(result?.error||"Unable to assign a Re-Rent task.");
      await load();
    } catch(error) {
      setActionError(error instanceof Error?error.message:"Unable to assign a Re-Rent task.");
    } finally { setBusy(""); }
  }

  const filtered=useMemo(()=>orders,[orders]);

  return <ManagerShell managerName={manager}>
    <div className="mo-head"><div><span>ORDER OPERATIONS</span><h1>Client Orders</h1><p>Review payments, activate orders and manage re-rent tasks.</p></div><button onClick={()=>void load(false)} disabled={loading}>Refresh</button></div>
    {actionError&&<div role="alert" className="mo-action-error">{actionError}</div>}
    <section className="mo-panel">
      <div className="mo-toolbar"><h2>Order Center</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, client, property..."/></div>
      <div className="mo-table"><table><thead><tr><th>Order</th><th>Client</th><th>Property</th><th>Original Rent</th><th>Final Return</th><th>Revenue / Profit</th><th>Payment evidence</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>
      {filtered.map(o=><tr key={o.id}><td><strong>{o.orderCode}</strong></td><td>{o.user?.name}<small>{o.user?.email}</small></td><td>{o.property?.title}</td><td>{money(o.amount)}</td><td>{o.status === "RE_RENTED" || o.status === "COMPLETED" ? o.finalReturnAmount ? money(o.finalReturnAmount) : <span className="mo-not-recorded">Legacy return unavailable</span> : <span className="mo-not-recorded">Pending</span>}</td><td>{["RE_RENTED","COMPLETED"].includes(o.status) ? money(o.profit) : <span className="mo-not-recorded">Not recorded</span>}</td><td>{o.paymentReference&&<small>Reference: {o.paymentReference}</small>}{o.paymentProofUrl&&<a href={o.paymentProofUrl} target="_blank" rel="noopener noreferrer">Open submitted proof ↗</a>}{!o.paymentReference&&!o.paymentProofUrl?"—":null}</td><td><b className={"mo-status "+o.status.toLowerCase()}>{o.status}</b></td><td>{date(o.createdAt)}</td><td><div className="mo-actions">
        {o.status==="PAYMENT_SUBMITTED"&&<button className="green" disabled={busy===o.id} onClick={()=>act(o.id,"VERIFY_PAYMENT")}>Verify</button>}
        {o.status==="PAYMENT_SUBMITTED"&&<button className="red" disabled={busy===o.id} onClick={()=>act(o.id,"REJECT_PAYMENT")}>Reject payment</button>}
        {o.status==="ACTIVE"&&<button className="dark" disabled={busy===o.id} onClick={()=>rerent(o.id)}>Re-Rent</button>}
        {!["COMPLETED","CANCELLED","RE_RENTED"].includes(o.status)&&<button className="red" disabled={busy===o.id} onClick={()=>act(o.id,"CANCEL")}>Cancel</button>}
      </div></td></tr>)}</tbody></table>{!filtered.length&&!loading&&<div className="mo-empty">No orders found.</div>}{nextCursor&&<div className="mo-more"><button onClick={()=>void load(true)} disabled={loadingMore}>{loadingMore?"Loading…":"Load more orders"}</button></div>}</div>
    </section>
    <style jsx global>{`
      .mo-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}.mo-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.mo-head h1{margin:5px 0;font-size:30px}.mo-head p{margin:0;color:#64748b;font-size:13px}.mo-head button{height:38px;border:0;border-radius:9px;background:#0f172a;color:white;padding:0 15px;font-weight:800}.mo-action-error{background:#fef2f2;color:#991b1b;padding:12px 15px;border-radius:9px;margin-bottom:14px;font-size:12px}.mo-more{text-align:center;padding:14px}.mo-more button{border:1px solid #dbe1ea;border-radius:8px;background:white;padding:9px 14px;cursor:pointer}
      .mo-panel{background:white;border:1px solid #e5e7eb;border-radius:15px;padding:20px;box-shadow:0 5px 20px rgba(15,23,42,.04)}.mo-toolbar{display:flex;justify-content:space-between;gap:15px;margin-bottom:16px}.mo-toolbar h2{margin:0;font-size:18px}.mo-toolbar input{width:280px;height:38px;border:1px solid #dbe1ea;border-radius:9px;padding:0 11px}
      .mo-table{overflow:auto;border:1px solid #eef2f7;border-radius:11px}.mo-table table{width:100%;min-width:1150px;border-collapse:collapse}.mo-table th{padding:11px;text-align:left;background:#f8fafc;color:#64748b;font-size:9px;text-transform:uppercase}.mo-table td{padding:12px;border-top:1px solid #eef2f7;font-size:11px;color:#334155}.mo-table td small,.mo-table td a{display:block;color:#64748b;margin-top:3px;overflow-wrap:anywhere}.mo-table td a{color:#175cd3}.mo-not-recorded{color:#8a9297;font-size:10px}.mo-actions{display:flex;gap:5px;flex-wrap:wrap}.mo-actions button{border:0;border-radius:7px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.mo-actions .green{background:#dcfce7;color:#166534}.mo-actions .dark{background:#0f172a;color:white}.mo-actions .red{background:#fee2e2;color:#991b1b}.mo-status{font-size:9px;padding:5px 7px;border-radius:999px;background:#f1f5f9}.mo-status.active,.mo-status.completed,.mo-status.re_rented{background:#dcfce7;color:#166534}.mo-status.payment_submitted,.mo-status.payment_pending,.mo-status.re_rent_pending{background:#fef3c7;color:#92400e}.mo-status.cancelled{background:#fee2e2;color:#991b1b}.mo-empty{text-align:center;padding:40px;color:#64748b}@media(max-width:700px){.mo-head,.mo-toolbar{flex-direction:column}.mo-toolbar input{width:100%}}
    `}</style>
  </ManagerShell>
}
