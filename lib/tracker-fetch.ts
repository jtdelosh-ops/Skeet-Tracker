// The target travels with requests from this tab only; no shared support cookie.
export function trackerFetch(url:string,init:RequestInit={}) {
  const target=new URLSearchParams(window.location.search).get("shooter");
  const headers=new Headers(init.headers);
  if(target) headers.set("x-skeet-shooter",target);
  return fetch(url,{...init,headers});
}
